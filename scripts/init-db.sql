-- Initialize the Flit database with some basic setup
-- This file runs automatically when the Docker PostgreSQL container starts

-- Create the main database (already created by POSTGRES_DB env var)
-- CREATE DATABASE flit_dev;

-- Create any additional schemas if needed
-- CREATE SCHEMA IF NOT EXISTS analytics;

-- You can add any initial data or setup here
-- For example, create some lookup tables, seed data, etc.

-- Log that initialization completed
DO $$
BEGIN
    RAISE NOTICE 'Flit database initialized successfully!';
END $$;