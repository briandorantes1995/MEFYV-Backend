require('dotenv').config();
const express = require('express');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

//Prueba Endpoint
router.get("/", (request, response) => {
    response.json({ message: "Hola usuario" });
});

module.exports = router;