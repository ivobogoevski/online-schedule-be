const express = require("express");
const router = express.Router();
const sql = require("mssql");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const {
  wrapError,
  DBError,
  UniqueViolationError,
  NotNullViolationError 
} = require('db-errors');
const checkAuth = require('../../middleware/auth-check');

router.post('/register', (req, res) => {
(async function(){
  try {
    const sqlRequest = new sql.Request();
    const password = await bcrypt.hash(req.body.Password, 10);
    sqlRequest.input('name', sql.VarChar, req.body.Name);
    sqlRequest.input('email', sql.VarChar, req.body.Email);
    sqlRequest.input('pass', sql.VarChar, password);
    sqlRequest.input('study', sql.VarChar, req.body.Study);
    sqlRequest.input('index', sql.VarChar, req.body.Index);
    const query = `
            INSERT INTO Students (Name, Email, Password, Study, IndexNumber)
            VALUES (@name, @email, @pass, @study, @index);
        `;
      await sqlRequest.query(query);
      res.status(201).json({ message: "You have successfully created new account." });
  } catch (error) {
    err = wrapError(error);
 
    if (err instanceof UniqueViolationError) {
      res.status(500).json({message: `Email already exists.`});
    } else if (err instanceof NotNullViolationError) {
      res.status(500).json({message: `${err.column} is required.`});
    } else {
      res.status(500).json({message: 'Sorry, some unknown error occurred. Please try again.'});
    }
  }
})()
});

router.put('/user', checkAuth, (req, res) => {
  (async function(){
    try {
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const sqlRequest = new sql.Request();
      sqlRequest.input('name', sql.VarChar, req.body.Name);
      sqlRequest.input('email', sql.VarChar, req.body.Email);
      sqlRequest.input('study', sql.VarChar, req.body.Study)
      sqlRequest.input('index', sql.VarChar, req.body.IndexNumber);
      sqlRequest.input('id', sql.VarChar, decodedToken.UserID);
      const query = `
              UPDATE Students 
              SET Name = @name, Email = @email, Study = @study, IndexNumber = @index
              WHERE ID = @id;
          `;
      await sqlRequest.query(query);
      const sqlReq = new sql.Request();
      sqlReq.input('email', sql.VarChar, req.body.Email);
      const sqlQuery = `SELECT * FROM Students WHERE Email = @email`;
      const queryRes = await sqlReq.query(sqlQuery);
      const token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].ID, Study: result.recordset[0].Study, IndexNumber: result.recordset[0].IndexNumber}, process.env.SECRET_KEY, {expiresIn: '1h'});
      const refreshToken = jwt.sign({Email: result.recordset[0].Email, PublicKey: result.recordset[0].Password, Type: '1'}, process.env.SECRET_KEY, {expiresIn: '24h'});
      res.status(200).json({token: token, refreshToken: refreshToken});
    } catch (error) {
      console.log(error);
      err = wrapError(error);
   
      if (err instanceof UniqueViolationError) {
        res.status(500).json({message: `Email already exists.`});
      } else if (err instanceof NotNullViolationError) {
        res.status(500).json({message: `${err.column} is required.`});
      } else {
        res.status(500).json({message: 'Sorry, some unknown error occurred. Please try again.'});
      }
    }
  })()
});

router.put('/change-password', checkAuth, (req, res) => {
  (async function(){
    try{
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const sqlRequest = new sql.Request();
      sqlRequest.input('email', sql.VarChar, decodedToken.Email);
      let dbTable = '';
      if(decodedToken.IndexNumber) {
        dbTable = 'Students';
      } else if(decodedToken.Office){
        dbTable = 'Teachers';
      }
      const query = `
        SELECT * FROM ${dbTable} WHERE Email = @email
      `;
      const result = await sqlRequest.query(query);
      if (result.recordset) {
        if (await bcrypt.compare(req.body.Password, result.recordset[0].Password)) {
          const sqlReq = new sql.Request();
          sqlReq.input('pass', sql.VarChar, await bcrypt.hash(req.body.NewPassword, 10));
          sqlReq.input('email', sql.VarChar, decodedToken.Email);
          const updateQuery = `
            UPDATE ${dbTable}
            SET Password = @pass
            WHERE Email = @email
          `;
          const updateResult = await sqlReq.query(updateQuery);
          let token;
          let refreshToken
          if(decodedToken.IndexNumber) {
            token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].ID, Study: result.recordset[0].Study, IndexNumber: result.recordset[0].IndexNumber}, process.env.SECRET_KEY, {expiresIn: '1h'});
            refreshToken = jwt.sign({Email: result.recordset[0].Email, PublicKey: await bcrypt.hash(req.body.NewPassword, 10), Type: '1'}, process.env.SECRET_KEY, {expiresIn: '24h'});
          } else if(decodedToken.Office){
            token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].TeacherId, Office: result.recordset[0].Office}, process.env.SECRET_KEY, {expiresIn: '1h'});
            refreshToken = jwt.sign({Email: result.recordset[0].Email, PublicKey: await bcrypt.hash(req.body.NewPassword, 10), Type: '0'}, process.env.SECRET_KEY, {expiresIn: '24h'});
          }
          res.status(200).json({message: 'Password has been updated successfully.', token: token, refreshToken: refreshToken});
        } else {
          res.status(400).json({ message: "Invalid password." });
        }
      } else {
        res.status(400).json({message: "You are not authorized to perform this action."})
      }
    }
    catch(err){
      console.log(err);
      res.status(500).json({message: err.message ? err.message : 'Sorry, some unknown error occurred. Please try again.'})
    }
  })()
});

router.put('/teacher', checkAuth, (req, res) => {
  (async function(){
    try {
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const sqlRequest = new sql.Request();
      sqlRequest.input('name', sql.VarChar, req.body.Name);
      sqlRequest.input('email', sql.VarChar, req.body.Email);
      sqlRequest.input('office', sql.VarChar, req.body.Office)
      sqlRequest.input('id', sql.VarChar, decodedToken.UserID);
      const query = `
              UPDATE Teachers 
              SET Name = @name, Email = @email, Office = @office
              WHERE TeacherID = @id;
          `;
      await sqlRequest.query(query);
      const sqlReq = new sql.Request();
      sqlReq.input('email', sql.VarChar, req.body.Email);
      const sqlQuery = `SELECT * FROM Teachers WHERE Email = @email`;
      const result = await sqlReq.query(sqlQuery);
      const token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].TeacherId, Office: result.recordset[0].Office}, process.env.SECRET_KEY, {expiresIn: '1h'});
      const refreshToken = jwt.sign({Email: result.recordset[0].Email, PublicKey: result.recordset[0].Password, Type: '0'}, process.env.SECRET_KEY, {expiresIn: '24h'});
      res.status(200).json({token: token, refreshToken: refreshToken});
    } catch (error) {
      console.log(error);
      err = wrapError(error);
   
      if (err instanceof UniqueViolationError) {
        res.status(500).json({message: `Email already exists.`});
      } else if (err instanceof NotNullViolationError) {
        res.status(500).json({message: `${err.column} is required.`});
      } else {
        res.status(500).json({message: 'Sorry, some unknown error occurred. Please try again.'});
      }
    }
  })()
});

router.post('/login', (req, res) => {
  (async function(){
    try {
      sqlRequest = new sql.Request();
      sqlRequest.input('email', sql.VarChar, req.body.Email);
      const query = `
        SELECT * FROM Students WHERE Email = @email
      `;
      const result = await sqlRequest.query(query);
      if (result.recordset) {
        if (await bcrypt.compare(req.body.Password, result.recordset[0].Password)) {
          const token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].ID, Study: result.recordset[0].Study, IndexNumber: result.recordset[0].IndexNumber}, process.env.SECRET_KEY, {expiresIn: '1h'});
          const refreshToken = jwt.sign({Email: result.recordset[0].Email, PublicKey: result.recordset[0].Password, Type: '1'}, process.env.SECRET_KEY, {expiresIn: '24h'});
          res.status(200).json({token: token, refreshToken: refreshToken});
        } else {
          res.status(400).json({ message: "Invalid password." });
        }
      } else {
        res.status(400).json({ message: "Invalid email address." });
      }
    } catch (error) {
      res.status(400).json({message: 'Invalid credentials.'});
    }
  })()
});

router.post('/teacher/login', (req, res) => {
  (async function(){
    try {
      sqlRequest = new sql.Request();
      sqlRequest.input('email', sql.VarChar, req.body.Email);
      const query = `
        SELECT * FROM Teachers WHERE Email = @email
      `;
      const result = await sqlRequest.query(query);
      if (result.recordset) {
        if (await bcrypt.compare(req.body.Password, result.recordset[0].Password) && result.recordset[0].Active) {
          const token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].TeacherId, Office: result.recordset[0].Office}, process.env.SECRET_KEY, {expiresIn: '1h'});
          const refreshToken = jwt.sign({Email: result.recordset[0].Email, PublicKey: result.recordset[0].Password, Type: '0'}, process.env.SECRET_KEY, {expiresIn: '24h'});
          res.status(200).json({token: token, refreshToken: refreshToken});
        } else {
          res.status(400).json({ message: "Invalid password." });
        }
      } else {
        res.status(400).json({ message: "Invalid email address." });
      }
    } catch (error) {
      res.status(400).json({message: 'Invalid credentials.'});
    }
  })()
});

router.post('/refresh-token', (req, res) => {
  (async function(){
    try {
      const refreshtoken = req.body.RefreshToken;
      const decodedToken = jwt.verify(refreshtoken, process.env.SECRET_KEY);
      sqlRequest = new sql.Request();
      sqlRequest.input('email', sql.VarChar, decodedToken.Email);
      let dbTable = '';
      if(decodedToken.Type === '0') {
        dbTable = 'Teachers';
      } else if(decodedToken.Type === '1'){
        dbTable = 'Students';
      }
      const query = `
        SELECT * FROM ${dbTable} WHERE Email = @email
      `;
      const result = await sqlRequest.query(query);
      if (result.recordset) {
        if (decodedToken.PublicKey === result.recordset[0].Password) {
          let token;
          if(decodedToken.Type === '0') {
            token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].TeacherId, Office: result.recordset[0].Office}, process.env.SECRET_KEY, {expiresIn: '1h'});
          } else if(decodedToken.Type === '1'){
            token = jwt.sign({Name: result.recordset[0].Name, Email: result.recordset[0].Email, UserID: result.recordset[0].ID, Study: result.recordset[0].Study, IndexNumber: result.recordset[0].IndexNumber}, process.env.SECRET_KEY, {expiresIn: '1h'});
          }
          res.status(200).json({token: token});
        } else {
          res.status(403).json({message: "You are not authorized to perform this action."});
        }
      } else {
        res.status(403).json({message: "You are not authorized to perform this action."});
      }
    } catch (error) {
      res.status(403).json({message: "You are not authorized to perform this action."});
    }
  })()
});

module.exports = router;