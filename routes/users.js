var express = require('express');
var router = express.Router();
const db = require('../utils/db');

/* --- MIDDLEWARE DE AUTENTICAÇÃO --- */
function auth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).send('Sessão expirada. Faça login novamente.');
  }
  next();
}

/* --- ROTA DE APOSTA ATUALIZADA --- */
router.post('/apostar', auth, (req, res) => {
    let { id_jogo, palpite, valor } = req.body;
    const usuarioId = req.session.usuario.id;
    const valorAposta = parseFloat(valor);

    // Validação inicial básica
    if (!id_jogo || !palpite || isNaN(valorAposta) || valorAposta <= 0) {
        return res.status(400).send("Palpite ou valor inválido.");
    }

    // 1. Buscar Saldo do Usuário E Dados do Jogo (Odds)
    const sqlDados = `
        SELECT u.saldo, j.odd_casa, j.odd_empate, j.odd_fora 
        FROM usuario u, jogos j 
        WHERE u.id = ? AND j.id = ?
    `;

    db.query(sqlDados, [usuarioId, id_jogo], (err, results) => {
        if (err || results.length === 0) return res.status(500).send("Erro ao validar dados da aposta.");

        const { saldo, odd_casa, odd_empate, odd_fora } = results[0];

        if (saldo < valorAposta) {
            return res.send("Saldo insuficiente!");
        }

        // --- DEFINIÇÃO DA ODD E NORMALIZAÇÃO ---
        let oddSelecionada = 0;
        if (palpite === "TIME_CASA") {
            oddSelecionada = odd_casa;
            palpite = "TIME_CASA"; 
        } else if (palpite === "EMPATE") {
            oddSelecionada = odd_empate;
            palpite = "EMPATE";
        } else if (palpite === "TIME_FORA") {
            oddSelecionada = odd_fora;
            palpite = "TIME_FORA";
        }

        const retornoPotencial = (valorAposta * oddSelecionada).toFixed(2);

        // 2. Iniciar Transação SQL
        db.beginTransaction((err) => {
            if (err) return res.status(500).send("Erro na transação.");

            // A: Descontar saldo do usuário
            db.query("UPDATE usuario SET saldo = saldo - ? WHERE id = ?", [valorAposta, usuarioId], (err) => {
                if (err) return db.rollback(() => res.status(500).send("Erro no débito."));

                // B: Registrar a aposta com o retorno calculado
                const sqlAposta = "INSERT INTO apostas_jogador (id_usuario, id_jogo, palpite, valor, retorno, status) VALUES (?, ?, ?, ?, ?, 'PENDENTE')";
                db.query(sqlAposta, [usuarioId, id_jogo, palpite, valorAposta, retornoPotencial], (err) => {
                    if (err) return db.rollback(() => res.status(500).send("Erro ao registrar aposta."));

                    // C: Registrar na tabela de TRANSAÇÕES (para aparecer no saldo/extrato)
                    const desc = `Aposta Realizada - Jogo ID ${id_jogo}`;
                    const sqlTrans = "INSERT INTO transacoes (id_usuario, valor, descricao, data) VALUES (?, ?, ?, NOW())";
                    db.query(sqlTrans, [usuarioId, -valorAposta, desc], (err) => {
                        if (err) return db.rollback(() => res.status(500).send("Erro no histórico."));

                        // D: Confirmar tudo
                        db.commit((err) => {
                            if (err) return db.rollback(() => res.status(500).send("Erro no commit."));
                            
                            // Atualiza saldo na sessão
                            req.session.usuario.saldo = (saldo - valorAposta).toFixed(2);
                            res.redirect('/painel?sucesso=true');
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;