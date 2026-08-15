// Runs before the e2e test file (and its imports) load, so AppModule picks
// up the test database instead of the dev one. Requires a `liberia360_test`
// Postgres database to exist locally (see api/README.md).
process.env.DB_DATABASE = process.env.TEST_DB_DATABASE ?? "liberia360_test";
