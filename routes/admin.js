console.log('✅ admin router carregado');

var express = require('express');
var router = express.Router();
const db = require('../utils/db');

/* ===============================
   MIDDLEWARE DE PROTEÇÃO (ADMIN)
================================ */
function authAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    next();
}

/* ===============================
   GESTÃO DE JOGOS
================================ */

// 1. FORMULÁRIO DE NOVO JOGO (GET)
router.get('/jogos/novo', authAdmin, (req, res) => {
    const sql = "SELECT * FROM categorias_jogos";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Erro ao buscar categorias:", err);
            return res.render('novo-jogo', { categorias: [], erro: "Erro ao carregar banco." });
        }
        res.render('novo-jogo', { categorias: results || [] });
    });
});

// 2. SALVAR NOVO JOGO (POST)
router.post('/jogos/novo', authAdmin, (req, res) => {
    const { id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora } = req.body;
    const sql = `INSERT INTO jogos (id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'ABERTO')`;

    db.query(sql, [id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora], (err, result) => {
        if (err) return res.status(500).send('Erro ao salvar jogo');
        res.redirect('/admin');
    });
});

// 3. FORMULÁRIO DE EDIÇÃO (GET)
router.get('/jogos/editar/:id', authAdmin, (req, res) => {
    const id = req.params.id;
    const sqlJogo = "SELECT * FROM jogos WHERE id = ?";
    const sqlCategorias = "SELECT * FROM categorias_jogos";

    db.query(sqlJogo, [id], (err, jogoResult) => {
        if (err || jogoResult.length === 0) return res.status(404).send("Jogo não encontrado.");

        db.query(sqlCategorias, (err, catResults) => {
            if (err) return res.status(500).send("Erro ao carregar categorias.");
            res.render('editar-jogo', { 
                jogo: jogoResult[0], 
                categorias: catResults 
            });
        });
    });
});

// 4. SALVAR EDIÇÃO (POST)
router.post('/jogos/editar/:id', authAdmin, (req, res) => {
    const id = req.params.id;
    let { 
        id_categoria, time_casa, time_fora, data_jogo, 
        odd_casa, odd_empate, odd_fora, status, resultado 
    } = req.body;

    const dataFormatada = data_jogo ? data_jogo.replace('T', ' ') : null;
    const n_casa = parseFloat(odd_casa.toString().replace(',', '.'));
    const n_empate = parseFloat(odd_empate.toString().replace(',', '.'));
    const n_fora = parseFloat(odd_fora.toString().replace(',', '.'));

    const sql = `
        UPDATE jogos 
        SET id_categoria=?, time_casa=?, time_fora=?, data_jogo=?, 
            odd_casa=?, odd_empate=?, odd_fora=?, status=?, resultado=? 
        WHERE id=?
    `;

    db.query(sql, [
        id_categoria, time_casa, time_fora, dataFormatada, 
        n_casa, n_empate, n_fora, status, resultado, id
    ], (err, result) => {
        if (err) return res.status(500).send("Erro ao salvar no banco.");
        res.redirect('/admin'); 
    });
});

// 5. EXCLUIR JOGO (POST)
router.post('/jogos/excluir/:id', authAdmin, (req, res) => {
    const id = req.params.id;
    db.query("DELETE FROM jogos WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).send("Erro ao excluir.");
        res.redirect('/admin');
    });
});

/* ===============================
   FINALIZAR E PAGAR APOSTAS (COM TRANSAÇÕES)
================================ */
router.post('/finalizar/:id', authAdmin, (req, res) => {
    const id_jogo = req.params.id;
    const { resultado_final } = req.body;

    // 1. Finaliza o jogo
    db.query(
        'UPDATE jogos SET status = "FINALIZADO", resultado = ? WHERE id = ?',
        [resultado_final, id_jogo],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Erro ao finalizar jogo.");
            }

            // 2. Busca apostas PENDENTES do jogo
            db.query(
                `SELECT a.*
                 FROM aposta a
                 INNER JOIN jogos_aposta ja ON ja.id_aposta = a.id
                 WHERE ja.id_jogo = ? AND a.status = 'PENDENTE'`,
                [id_jogo],
                (err, apostas) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Erro ao buscar apostas.");
                    }

                    if (apostas.length === 0) {
                        return res.send("Jogo encerrado. Nenhuma aposta pendente.");
                    }

                    // 3. Processa cada aposta
                    apostas.forEach(aposta => {
                        const acertou = aposta.palpite === resultado_final;
                        const novoStatus = acertou ? 'GANHOU' : 'PERDEU';

                        // 4. Atualiza status da aposta (TABELA CORRETA)
                        db.query(
                            'UPDATE aposta SET status = ? WHERE id = ?',
                            [novoStatus, aposta.id],
                            (err) => {
                                if (err) console.error("Erro ao atualizar aposta:", err);
                            }
                        );

                        if (acertou) {
                            const premio = Number(aposta.retorno);

                            // 5. Credita saldo do usuário
                            db.query(
                                'UPDATE usuario SET saldo = saldo + ? WHERE id = ?',
                                [premio, aposta.id_usuario],
                                (err) => {
                                    if (!err) {
                                        // 6. Registra transação
                                        db.query(
                                            'INSERT INTO transacoes (id_usuario, valor, descricao) VALUES (?, ?, ?)',
                                            [
                                                aposta.id_usuario,
                                                premio,
                                                `Prêmio aposta ${aposta.id} | Jogo ${id_jogo}`
                                            ]
                                        );
                                    }
                                }
                            );
                        }
                    });

                    res.send("Jogo finalizado, apostas processadas e pagamentos realizados!");
                }
            );
        }
    );
});

module.exports = router;