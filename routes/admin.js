console.log('✅ admin router carregado');

var express = require('express');
var router = express.Router();
const db = require('../db'); // Certifique-se de que o caminho para seu db.js está correto

/* --- LOGIN & REGISTER --- */
router.get('/login', (req, res) => {
  res.render('admin-login');
});

router.post('/login', (req, res) => {
  res.send('Login admin funcionando');
});

router.get('/register', (req, res) => {
  res.render('admin-register');
});

router.post('/register', (req, res) => {
  res.send('Registro admin funcionando');
});

/* --- GESTÃO DE JOGOS --- */

// Rota para EXIBIR o formulário (Atualizada para buscar do Banco)
router.get('/jogos/novo', (req, res) => {
  const sql = "SELECT * FROM categorias_jogos"; // Busca categorias reais do seu banco

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao buscar categorias:", err);
      return res.status(500).send("Erro ao carregar categorias.");
    }
    
    // Renderiza a view passando os dados que vieram do banco de dados
    res.render('novo-jogo', { categorias: results });
  });
});

// Rota para RECEBER os dados do formulário
router.post('/jogos/novo', (req, res) => {
    const { id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora } = req.body;

    const sql = `
        INSERT INTO jogos 
        (id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora], (err, result) => {
        if (err) {
            // Se o erro for ER_NO_REFERENCED_ROW_2, significa que o ID da categoria não existe no banco
            console.error("Erro detalhado no banco:", err);
            return res.status(500).send("Erro interno ao salvar o jogo. Verifique se a categoria existe.");
        }

        console.log("✅ Jogo salvo no banco com ID:", result.insertId);
        res.send('Jogo cadastrado com sucesso no banco de dados!');
    });
});

module.exports = router;