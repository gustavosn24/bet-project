var express = require('express');
var router = express.Router();
var db = require('../utils/db');

/* ===============================
   REGISTER
================================ */
router.get('/register', (req, res) => {
  res.render('register', { erro: null });
});

router.post('/register', (req, res) => {
  const { cpf, nome, email, senha } = req.body;

  const checkSql = `
    SELECT id FROM usuario
    WHERE email = ? OR cpf = ?
  `;

  db.query(checkSql, [email, cpf], (err, rows) => {
    if (err) return res.send(err);

    if (rows.length > 0) {
      return res.render('register', {
        erro: 'Email ou CPF já cadastrados'
      });
    }

    const insertSql = `
      INSERT INTO usuario (cpf, nome, email, senha, saldo)
      VALUES (?, ?, ?, ?, 100)
    `;

    db.query(insertSql, [cpf, nome, email, senha], err => {
      if (err) return res.send(err);
      res.redirect('/login');
    });
  });
});

/* ===============================
   LOGIN
================================ */
router.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  const sql = `
    SELECT id, nome, saldo
    FROM usuario
    WHERE email = ? AND senha = ?
  `;

  db.query(sql, [email, senha], (err, users) => {
    if (err) return res.send(err);

    if (users.length === 0) {
      return res.render('login', {
        erro: 'Email ou senha inválidos'
      });
    }

    req.session.usuario = users[0];
    res.redirect('/loading');
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

/* ===============================
   MIDDLEWARE AUTH
================================ */
function auth(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }
  next();
}

/* ===============================
   ÁREA PRINCIPAL / APOSTAR
================================ */
router.get('/apostar', auth, (req, res, next) => {
  const sql = `
    SELECT 
      j.id,
      j.time_casa,
      j.time_fora,
      j.data_jogo,
      j.status,
      j.odd_casa,
      j.odd_empate,
      j.odd_fora,
      c.nome AS categoria
    FROM jogos j
    INNER JOIN categorias_jogos c ON j.id_categoria = c.id
    WHERE j.status = 'ABERTO'
    ORDER BY j.data_jogo ASC
  `;

  db.query(sql, (err, jogos) => {
    if (err) return next(err);
    res.render('apostar', {
      jogos,
      usuario: req.session.usuario
    });
  });
});

/* ===============================
   APOSTAR
================================ */
router.post('/apostar', auth, (req, res) => {
    const { id_jogo, palpite, valor } = req.body;
    const id_usuario = req.session.usuario.id;
    const valorAposta = Number(valor);

    if (!id_jogo || isNaN(valorAposta) || valorAposta <= 0) {
        return res.status(400).send('Dados de aposta inválidos.');
    }

    // --- NOVA TRAVA: VERIFICAR SE O USUÁRIO JÁ APOSTOU NESTE JOGO ---
    const checkDupSql = `
        SELECT a.id 
        FROM aposta a
        INNER JOIN jogos_aposta ja ON a.id = ja.id_aposta
        WHERE a.id_usuario = ? AND ja.id_jogo = ?
    `;

    db.query(checkDupSql, [id_usuario, id_jogo], (err, dupRows) => {
        if (err) return res.send('Erro ao verificar histórico de apostas.');
        
        if (dupRows.length > 0) {
            return res.send('Você já realizou um palpite para este jogo. Apenas um palpite é permitido.');
        }

        // --- CONTINUAÇÃO DA LÓGICA DE APOSTA ---
        db.query('SELECT * FROM jogos WHERE id = ? AND status = "ABERTO"', [id_jogo], (err, jogos) => {
            if (err || jogos.length === 0) return res.send('Jogo não disponível ou encerrado.');

            const jogo = jogos[0];
            let odd;

            if (palpite === 'TIME_CASA') odd = jogo.odd_casa;
            else if (palpite === 'EMPATE') odd = jogo.odd_empate;
            else if (palpite === 'TIME_FORA') odd = jogo.odd_fora;
            else return res.send('Palpite inválido.');

            const retornoPossivel = valorAposta * odd;

            db.beginTransaction((err) => {
                if (err) return res.send('Erro ao processar sistema.');

                // Descontar saldo
                db.query('UPDATE usuario SET saldo = saldo - ? WHERE id = ? AND saldo >= ?', 
                [valorAposta, id_usuario, valorAposta], (err, result) => {
                    
                    if (err || result.affectedRows === 0) {
                        return db.rollback(() => res.send('Saldo insuficiente.'));
                    }

                    // Gravar Aposta
                    db.query(`INSERT INTO aposta (id_usuario, valor, palpite, odd, retorno, status, criada) 
                               VALUES (?, ?, ?, ?, ?, 'PENDENTE', NOW())`,
                    [id_usuario, valorAposta, palpite, odd, retornoPossivel], (err, resAposta) => {
                        
                        if (err) return db.rollback(() => res.send('Erro ao gravar aposta.'));
                        const id_new_aposta = resAposta.insertId;

                        // Vincular Jogo
                        db.query('INSERT INTO jogos_aposta (id_aposta, id_jogo) VALUES (?, ?)', 
                        [id_new_aposta, id_jogo], (err) => {
                            
                            if (err) return db.rollback(() => res.send('Erro ao vincular jogo.'));

                            db.commit((err) => {
                                if (err) return db.rollback(() => res.send('Erro no commit.'));
                                
                                req.session.usuario.saldo -= valorAposta;
                                res.redirect('/apostar?sucesso=1');
                            });
                        });
                    });
                });
            });
        });
    });
});

/* ===============================
   ADMIN REGISTER
================================ */
router.get('/admin/register', (req, res) => {
  res.render('admin-register', { erro: null });
});

router.post('/admin/register', (req, res) => {
  const { cpf, nome, email, senha } = req.body;

  const checkSql = `
    SELECT id FROM admin
    WHERE email = ? OR cpf = ?
  `;

  db.query(checkSql, [email, cpf], (err, rows) => {
    if (err) return res.send(err);

    if (rows.length > 0) {
      return res.render('admin-register', {
        erro: 'Email ou CPF já cadastrados'
      });
    }

    const insertSql = `
      INSERT INTO admin (cpf, nome, email, senha)
      VALUES (?, ?, ?, ?)
    `;

    db.query(insertSql, [cpf, nome, email, senha], err => {
      if (err) return res.send(err);
      res.redirect('/admin/login');
    });
  });
});

/* ===============================
   MIDDLEWARE ADMIN
================================ */
function authAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
}

/* ===============================
   LOGIN ADMIN
================================ */
router.get('/admin/login', (req, res) => {
  res.render('admin-login', { erro: null });
});

router.post('/admin/login', (req, res) => {
  const { email, senha } = req.body;

  const sql = `
    SELECT id, nome
    FROM admin
    WHERE email = ? AND senha = ?
  `;

  db.query(sql, [email, senha], (err, rows) => {
    if (err) return res.send(err);

    if (rows.length === 0) {
      return res.render('admin-login', {
        erro: 'Email ou senha inválidos'
      });
    }

    req.session.admin = rows[0];
    res.redirect('/admin-loading');
  });
});

router.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

/* ===============================
   PAINEL ADMIN
================================ */
router.get('/admin', authAdmin, (req, res, next) => {
  const sql = `
    SELECT 
      j.id,
      j.time_casa,
      j.time_fora,
      j.data_jogo,
      j.status,
      j.odd_casa,
      j.odd_empate,
      j.odd_fora,
      c.nome AS categoria
    FROM jogos j
    INNER JOIN categorias_jogos c ON j.id_categoria = c.id
    ORDER BY j.data_jogo DESC
  `;

  db.query(sql, (err, jogos) => {
    if (err) return next(err);
    res.render('admin', { jogos });
  });
});

/* ===============================
   NOVO JOGO
================================ */
router.get('/admin/novo-jogo', authAdmin, (req, res, next) => {
  db.query('SELECT * FROM categorias_jogos', (err, categorias) => {
    if (err) return next(err);
    res.render('novo-jogo', { categorias });
  });
});

router.post('/admin/novo-jogo', authAdmin, (req, res, next) => {
  const {
    id_categoria,
    time_casa,
    time_fora,
    data_jogo,
    odd_casa,
    odd_empate,
    odd_fora
  } = req.body;

  const sql = `
    INSERT INTO jogos
    (id_categoria, time_casa, time_fora, data_jogo,
     odd_casa, odd_empate, odd_fora, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ABERTO')
  `;

  db.query(sql, [
    id_categoria,
    time_casa,
    time_fora,
    data_jogo,
    odd_casa,
    odd_empate,
    odd_fora
  ], err => {
    if (err) return next(err);
    res.redirect('/admin');
  });
});

/* --- ROTA PARA EXCLUIR JOGO --- */
router.get('/jogos/deletar/:id', (req, res) => {
    const id = req.params.id;

    const sql = "DELETE FROM jogos WHERE id = ?";

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("❌ Erro ao excluir jogo:", err);
            return res.status(500).send("Erro ao excluir o jogo do banco de dados.");
        }

        console.log(`✅ Jogo com ID ${id} foi excluído com sucesso.`);
        
        // Redireciona de volta para a lista ou para o formulário de novo jogo
        res.redirect('/admin');
    });
});

/* ===============================
   FINALIZAR JOGO E PAGAR PRÊMIOS
================================ */
router.post('/apostar', auth, (req, res) => {
    const { id_jogo, palpite, valor } = req.body;
    const id_usuario = req.session.usuario.id;
    const valorAposta = Number(valor);

    // 1. Buscar a Odd correta do jogo
    db.query('SELECT * FROM jogos WHERE id = ? AND status = "ABERTO"', [id_jogo], (err, jogos) => {
        if (err || jogos.length === 0) return res.send("Jogo não disponível.");

        const jogo = jogos[0];
        let odd = 0;
        if (palpite === 'TIME_CASA') odd = jogo.odd_casa;
        else if (palpite === 'EMPATE') odd = jogo.odd_empate;
        else if (palpite === 'TIME_FORA') odd = jogo.odd_fora;

        const retornoPossivel = valorAposta * odd;

        // 2. Iniciar Transação para garantir que o saldo só saia se a aposta for gravada
        db.beginTransaction((err) => {
            if (err) return res.send("Erro no servidor.");

            // A: Deduzir saldo
            db.query('UPDATE usuario SET saldo = saldo - ? WHERE id = ? AND saldo >= ?', [valorAposta, id_usuario, valorAposta], (err, result) => {
                if (err || result.affectedRows === 0) {
                    return db.rollback(() => res.send("Saldo insuficiente."));
                }

                // B: Inserir na tabela 'apostas_jogador' (conforme sua imagem)
                const sqlInsert = `
                    INSERT INTO apostas_jogador 
                    (id_usuario, id_jogo, palpite, valor, odd, retorno, status, criada) 
                    VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', NOW())
                `;
                
                db.query(sqlInsert, [id_usuario, id_jogo, palpite, valorAposta, odd, retornoPossivel], (err) => {
                    if (err) return db.rollback(() => res.send("Erro ao registrar aposta."));

                    db.commit((err) => {
                        if (err) return db.rollback(() => res.send("Erro final."));
                        
                        req.session.usuario.saldo -= valorAposta;
                        res.send("✅ Sucesso! Aposta registrada na tabela apostas_jogador.");
                    });
                });
            });
        });
    });
});

router.get('/admin-loading', (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  res.render('admin-loading');
});

router.get('/loading', (req, res) => {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }
  res.render('loading');
});




module.exports = router;