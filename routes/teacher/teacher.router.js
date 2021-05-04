const express = require('express');
const router = express.Router();
const sql = require('mssql');
const authCheck = require('../../middleware/auth-check');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

// GET ALL TEACHERS
router.get('/', authCheck, (req, res) => {
  (async function() {
    try {
      const sqlRequest = new sql.Request();
      const sqlQuery = "SELECT TeacherId, Name, Email, Office, Active FROM Teachers WHERE Email <> 'superadmin@fikt.com'";
      const result = await sqlRequest.query(sqlQuery);
      res.status(200).json(result.recordset)
    } catch (error) {
      handleError(error, res);
    }
  })()
});

// ADD NEW TEACHER
router.post('/', authCheck, (req, res) => {
  (async function(){
    try {
      const cryptedPassword = await bcrypt.hash(req.body.Password, 10);
      const sqlRequest = new sql.Request();
      sqlRequest.input('name', req.body.Name);
      sqlRequest.input('email', req.body.Email);
      sqlRequest.input('office', req.body.Office);
      sqlRequest.input('pass', cryptedPassword);
      const sqlQuery = `
        INSERT INTO Teachers (Name, Email, Office, Password)
        VALUES (@name, @email, @office, @pass)
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json(result);
    } catch (error) {
      handleError(error, res);
    }
  })()
});

// EDIT TEACHER
router.put('/', authCheck, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('id', req.body.TeacherId);
      sqlRequest.input('name', req.body.Name);
      sqlRequest.input('email', req.body.Email);
      sqlRequest.input('office', req.body.Office);
      const sqlQuery = `
        UPDATE Teachers SET  Name = @name, Email = @email, Office = @office
        WHERE TeacherId = @id;
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json({message: 'Success'});
    } catch (error) {
      handleError(error, res);
    }
  })()
});

// CHANGE TEACHER Status
router.put('/status', authCheck, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('id', req.body.TeacherId);
      sqlRequest.input('status', req.body.Active)
      const sqlQuery = `
        UPDATE Teachers SET Active = @status
        WHERE TeacherId = @id;
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json({message: 'Success'});
    } catch (error) {
      console.log(error)
      handleError(error, res);
    }
  })()
});

// GET ALL CLASSES ASSIGNED TO TEACHER
router.get('/classes', authCheck, (req, res) => {
  (async function(){
    try {
      const userId = jwt.verify(req.headers.authorization, process.env.SECRET_KEY).UserID;
      const sqlRequest = new sql.Request();
      sqlRequest.input('userId', userId);
      const sqlQuery = `
      SELECT
        c.Name as 'Name',
        c.Code AS 'Code',
        c.Classroom AS 'Classroom',
        c.ClassDate AS 'ClassDate',
        c.ExerciseRoom AS 'ExerciseRoom',
        c.ExerciseDate AS 'ExerciseDate',
        c.Semester AS 'Semester',
        c.Study AS 'Study',
        t.Name AS 'TeacherName',
        t.TeacherId AS 'TeacherId'
      FROM Teachers as t
        inner join TeacherClasses as tc on (tc.TeacherId = t.TeacherId)
        inner join Classes as c on (tc.ClassCode = c.Code)
      WHERE
        t.TeacherID = @userId
      `;

      const result = await sqlRequest.query(sqlQuery);
      const response = [];
      result.recordset.forEach( r => {
        r.Teacher = {};
        r.Teacher.Name = r.TeacherName;
        r.Teacher.TeacherId = r.TeacherId;
        delete r.TeacherName;
        delete r.TeacherId;
        response.push(r);
      });
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  })()
});

// ASSIGN CLASS TO TEACHER
router.post('/assign/class', authCheck, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('classCode', req.body.ClassCode);
      sqlRequest.input('teacherId', req.body.TeacherId);
      const sqlQuery = `
        INSERT INTO TeacherClasses (ClassCode, TeacherId)
        VALUES (@classCode, @teacherId)
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json(result);
    } catch (error) {
      handleError(error, res);
    }
  })()
});

function handleError(e, res){
  res.status(500).json(e.originalError.info.message);
}

module.exports = router;