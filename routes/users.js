var express = require('express');
var router = express.Router();

/* ===============================
   MIDDLEWARE DE AUTENTICAÇÃO
================================ */
function auth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({
      erro: 'Usuário não autenticado'
    });
  }
  next();
}

/* ===============================
   ROTA BASE
================================ */
router.get('/', (req, res) => {
  res.json({
    mensagem: 'API de usuários funcionando 🚀'
  });
});

/* ===============================
   PERFIL DO USUÁRIO LOGADO
================================ */
router.get('/perfil', auth, (req, res) => {
  res.json({
    usuario: {
      id: req.session.usuario.id,
      nome: req.session.usuario.nome,
      saldo: req.session.usuario.saldo
    }
  });
});

/* ===============================
   LOGOUT
================================ */
router.post('/logout', auth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        erro: 'Erro ao sair'
      });
    }
    res.json({
      mensagem: 'Logout realizado com sucesso'
    });
  });
});

module.exports = router;
