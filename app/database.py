from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite database file
DATABASE_URL = "sqlite:///./expenses.db"

# Create engine (connection)
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Session to interact with DB
SessionLocal = sessionmaker(bind=engine)

# Base class for models
Base = declarative_base()