import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
const {Pool} = pkg;

const isProduction = process.env.NODE_ENV === "production";

const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

export const pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    database: process.env.PGDATABASE, 
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    rejectUnauthorized: true,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
});

export default pool;
