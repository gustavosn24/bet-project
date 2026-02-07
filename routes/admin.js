console.log('✅ admin router carregado');

var express = require('express');
var router = express.Router();
const db = require('../utils/db'); // Certifique-se de que o caminho para seu db.js está correto

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

/* --- GESTÃO DE JOGOS --- */

// Rota para EXIBIR o formulário
router.get('/jogos/novo', (req, res) => {
  const sql = "SELECT * FROM categorias_jogos";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar categorias:", err);
      // Passamos um array vazio para o EJS não dar erro de "categorias is not defined"
      return res.render('novo-jogo', { categorias: [], erro: "Erro ao carregar categorias do banco." });
    }
    
    // DEBUG: Verifique se aparece algo no seu terminal do VS Code quando você carrega a página
    console.log("📊 Dados recuperados do banco:", results);
    
    // Renderiza a view enviando os resultados (results sempre deve ser um array)
    res.render('novo-jogo', { categorias: results || [] });
  });
});

// Rota para RECEBER os dados do formulário
router.post('/jogos/novo', (req, res) => {
  const {
    id_categoria,
    time_casa,
    time_fora,
    data_jogo,
    odd_casa,
    odd_empate,
    odd_fora
  } = req.body;

  if (!id_categoria || !time_casa || !time_fora || !data_jogo) {
    return res.status(400).send('Preencha todos os campos obrigatórios');
  }

  const sql = `
    INSERT INTO jogos
    (id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [id_categoria, time_casa, time_fora, data_jogo, odd_casa, odd_empate, odd_fora],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao salvar jogo');
      }

      console.log('✅ Jogo criado:', result.insertId);
      res.redirect('/admin/jogos/novo'); // ou lista de jogos
    }
  );
});


module.exports = router;