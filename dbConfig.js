import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
const {Pool} = pkg;

const isProduction = process.env.NODE_ENV === "production";

const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

export const pool = new Pool({
    connectionString: isProduction ? process.env.DATABASE_URL : connectionString,
    ssl: true
});

export default pool;
