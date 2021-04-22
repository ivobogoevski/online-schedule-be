const express = require('express');
const router = express.Router();
const sql = require('mssql');
const authCheck = require('../../middleware/auth-check');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const {
  wrapError,
  DBError,
  UniqueViolationError,
  NotNullViolationError 
} = require('db-errors');

router.get('/', authCheck, (req,res) => {
  (async function(){
    try {
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const userId = decodedToken.UserID;
      const sqlRequest = new sql.Request();
      sqlRequest.input('userId', userId);
      const sqlQuery = `SELECT 
      c.Name as 'Name',
      c.Code AS 'Code',
      t.Name AS 'TeacherName',
      t.TeacherId AS 'TeacherId',
      n.NotificationDate AS 'NotificationDate',
      n.NotificationId AS 'NotificationId',
      n.NotificationContent AS 'NotificationContent',
      n.EditDate AS 'EditDate'
    FROM Students as s
      inner join StudentClasses as sc on (sc.StudentId = s.ID)
      inner join Notifications as n on (n.ClassCode = sc.ClassCode)
      inner join Classes as c on (c.Code = n.ClassCode)
      inner join TeacherClasses as tc on (tc.ClassCode = n.ClassCode)
      inner join Teachers as t on (t.TeacherId = tc.TeacherId)
    WHERE
      s.ID = @userId
      ORDER BY n.EditDate DESC`;
      const result = await sqlRequest.query(sqlQuery);
      const response = []; 
      result.recordset.forEach( n => {
        n.Teacher = {
          TeacherId: n.TeacherId,
          Name: n.TeacherName
        };
        n.Class = {
          Code: n.Code,
          Name: n.Name
        }

        delete n.Name;
        delete n.Code;
        delete n.TeacherId;
        delete n.TeacherName;
        response.push(n);
      });
      res.status(200).json(response);
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })()
});

router.get('/teacher', authCheck, (req,res) => {
  (async function(){
    try {
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const userId = decodedToken.UserID;
      const sqlRequest = new sql.Request();
      sqlRequest.input('userId', userId);
      const sqlQuery = `SELECT 
      c.Name as 'Name',
      c.Code AS 'Code',
      t.Name AS 'TeacherName',
      t.TeacherId AS 'TeacherId',
      n.NotificationDate AS 'NotificationDate',
      n.NotificationId AS 'NotificationId',
      n.NotificationContent AS 'NotificationContent',
      n.EditDate AS 'EditDate'
    FROM Teachers as t
      inner join TeacherClasses as tc on (tc.TeacherId = t.TeacherId)
      inner join Notifications as n on (n.ClassCode = tc.ClassCode)
      inner join Classes as c on (c.Code = n.ClassCode)
    WHERE
      t.TeacherId = @userId
    ORDER BY n.EditDate DESC`;
      const result = await sqlRequest.query(sqlQuery);
      const response = []; 
      result.recordset.forEach( n => {
        n.Teacher = {
          TeacherId: n.TeacherId,
          Name: n.TeacherName
        };
        n.Class = {
          Code: n.Code,
          Name: n.Name
        }

        delete n.Name;
        delete n.Code;
        delete n.TeacherId;
        delete n.TeacherName;
        response.push(n);
      });
      res.status(200).json(response);
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })()
});

router.post('/', authCheck, (req,res) => {
  (async function(){
    try {
      const decodedToken = jwt.verify(req.headers.authorization, process.env.SECRET_KEY);
      const teacherId = decodedToken.UserID;
      const sqlRequest = new sql.Request();
      sqlRequest.input('date', req.body.NotificationDate);
      sqlRequest.input('content', req.body.NotificationContent);
      sqlRequest.input('teacherId', teacherId);
      sqlRequest.input('classCode', req.body.ClassCode);
      const sqlQuery = `INSERT INTO Notifications (NotificationDate, NotificationContent, TeacherId, ClassCode, EditDate)
        VALUES (@date, @content, @teacherId, @classCode, @date)
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(201).json({message: 'Notification is successfully created.'});
    } catch (error) {
      console.log(error);
      handleError(error, res);
    }
  })()
});

router.put('/', authCheck, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('content', req.body.NotificationContent);
      sqlRequest.input('id', req.body.NotificationId);
      sqlRequest.input('editDate', new Date().valueOf().toString());
      const sqlQuery = `UPDATE Notifications 
        SET NotificationContent = @content, EditDate = @editDate
        WHERE NotificationId = @id;
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(200).json(req.body);
    } catch (error) {
      console.log(error);
      handleError(error);
    }
  })()
});

router.delete('/:notificationId', authCheck, (req, res) => {
  (async function(){
    try {
      const sqlRequest = new sql.Request();
      sqlRequest.input('id', req.params.notificationId);
      const sqlQuery = `DELETE FROM Notifications
        WHERE NotificationId = @id;
      `;
      const result = await sqlRequest.query(sqlQuery);
      res.status(200).json(req.body);
    } catch (error) {
      console.log(error);
      handleError(error);
    }
  })()
});

function handleError(error, res) {
  err = wrapError(error);
  if (err instanceof UniqueViolationError) {
    res.status(500).json({message: `${err.column} already exists.`});
  } else if (err instanceof NotNullViolationError) {
    res.status(500).json({message: `${err.column} is required.`});
  } else {
    res.status(500).json({message: 'Sorry, some unknown error occurred. Please try again.'});
  }
}

module.exports = router;