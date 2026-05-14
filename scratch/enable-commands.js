import pg from 'pg';

const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'tartware',
    user: 'postgres',
    password: 'postgres',
});

async function main() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const result = await client.query(`
            UPDATE command_features 
            SET status = 'enabled' 
            WHERE environment = 'development' AND status = 'disabled'
        `);

        console.log(`Successfully enabled ${result.rowCount} commands.`);
    } catch (err) {
        console.error('Error enabling commands:', err);
    } finally {
        await client.end();
    }
}

main();
