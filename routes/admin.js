console.log('✅ admin router carregado');

var express = require('express');
var router = express.Router();
const db = require('../utils/db');

/* --- GESTÃO DE JOGOS --- */

// 1. FORMULÁRIO DE NOVO JOGO (GET)
router.get('/jogos/novo', (req, res) => {
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
router.post('/jogos/novo', (req, res) => {
    const { id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora } = req.body;
    const sql = `INSERT INTO jogos (id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora], (err, result) => {
        if (err) return res.status(500).send('Erro ao salvar jogo');
        res.redirect('/admin');
    });
});

// 3. FORMULÁRIO DE EDIÇÃO (GET)
router.get('/jogos/editar/:id', (req, res) => {
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

// ... (restante do código anterior igual)

// 4. SALVAR EDIÇÃO (POST) - ATUALIZADO COM STATUS E RESULTADO
router.post('/jogos/editar/:id', (req, res) => {
    const id = req.params.id;
    let { 
        id_categoria, time_casa, time_fora, data_jogo, 
        odd_casa, odd_empate, odd_fora, status, resultado 
    } = req.body;

    // Ajuste da Data para o MySQL
    const dataFormatada = data_jogo ? data_jogo.replace('T', ' ') : null;

    // Conversão de números (garante ponto decimal)
    const n_casa = parseFloat(odd_casa.toString().replace(',', '.'));
    const n_empate = parseFloat(odd_empate.toString().replace(',', '.'));
    const n_fora = parseFloat(odd_fora.toString().replace(',', '.'));

    // SQL atualizado para incluir status e resultado
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
        if (err) {
            console.error("❌ Erro no UPDATE:", err);
            return res.status(500).send("Erro ao salvar no banco.");
        }

        console.log(`✅ Sucesso: ${result.affectedRows} linha(s) alterada(s).`);
        res.redirect('/admin'); 
    });
});

// 5. EXCLUIR JOGO (POST)
router.post('/jogos/excluir/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM jogos WHERE id = ?";

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("❌ Erro ao excluir jogo:", err);
            return res.status(500).send("Erro ao tentar excluir o jogo.");
        }

        console.log(`🗑️ Jogo ${id} excluído com sucesso.`);
        res.redirect('/admin'); // Ou para a sua listagem de jogos
    });
});



module.exports = router;