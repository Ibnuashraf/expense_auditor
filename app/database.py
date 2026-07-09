import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Pull database URL from environment, default to SQLite locally
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expenses.db")

# Automatically fix postgresql connection scheme if returned as postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Create engine
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Session to interact with DB
SessionLocal = sessionmaker(bind=engine)

# Base class for models
Base = declarative_base()