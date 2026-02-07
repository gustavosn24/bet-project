var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

// ROTAS (Corrigido: removida a duplicata do adminRouter)
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');

var app = express();

/* SESSION */
app.use(session({
  secret: 'bet-secreta',
  resave: false,
  saveUninitialized: false
}));

/* USER GLOBAL */
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  next();
});

/* VIEW ENGINE */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

/* MIDDLEWARES */
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ROUTES */
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/admin', adminRouter);

/* 404 */
app.use(function(req, res, next) {
  res.status(404).render('error', {
    message: 'Página não encontrada',
    error: { status: 404 }
  });
});

/* ERROR HANDLER */
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;