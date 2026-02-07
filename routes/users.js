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

/* --- ROTA DE APOSTA (ALTERADA) --- */
router.post('/apostar', auth, (req, res) => {
    let { id_jogo, palpite, valor } = req.body;
    const usuarioId = req.session.usuario.id;
    const valorAposta = parseFloat(valor);

    // --- NORMALIZAÇÃO DO PALPITE ---
    // Isso garante que se o HTML enviar "CASA", o banco receba "TIME CASA VENCEU"
    if (palpite === "TIME CASA") palpite = "TIME CASA VENCEU";
    if (palpite === "TIME FORA") palpite = "TIME FORA VENCEU";
    // "EMPATE" geralmente já é igual no HTML e no Banco

    // Validação
    if (!id_jogo || !palpite || isNaN(valorAposta) || valorAposta <= 0) {
        return res.status(400).send("Palpite ou valor inválido.");
    }

    // 1. Verificar saldo no banco
    db.query("SELECT saldo FROM usuario WHERE id = ?", [usuarioId], (err, results) => {
        if (err || results.length === 0) return res.status(500).send("Erro ao verificar saldo.");

        const saldoAtual = results[0].saldo;

        if (saldoAtual < valorAposta) {
            return res.send("Saldo insuficiente!");
        }

        // 2. Iniciar Transação
        db.beginTransaction((err) => {
            if (err) return res.status(500).send("Erro ao iniciar transação.");

            // A: Descontar saldo
            db.query("UPDATE usuario SET saldo = saldo - ? WHERE id = ?", [valorAposta, usuarioId], (err) => {
                if (err) return db.rollback(() => res.status(500).send("Erro ao processar débito."));

                // B: Inserir aposta com o palpite normalizado
                const sqlInsert = "INSERT INTO apostas_jogador (id_usuario, id_jogo, palpite, valor) VALUES (?, ?, ?, ?)";
                db.query(sqlInsert, [usuarioId, id_jogo, palpite, valorAposta], (err) => {
                    if (err) {
                        console.error("Erro no INSERT:", err);
                        return db.rollback(() => res.status(500).send("Erro ao registrar aposta no banco."));
                    }

                    // C: Confirmar tudo
                    db.commit((err) => {
                        if (err) return db.rollback(() => res.status(500).send("Erro no commit."));
                        
                        // Atualiza a sessão para o front-end mostrar o saldo novo
                        req.session.usuario.saldo = (saldoAtual - valorAposta).toFixed(2);
                        
                        // Redireciona de volta para o painel com sinal de sucesso
                        res.redirect('/painel?sucesso=true');
                    });
                });
            });
        });
    });
});

module.exports = router;