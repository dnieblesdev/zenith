from loguru import logger
import sys
import os

# Create logs directory if it doesn't exist
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "zenith.log")

# Configure logger
logger.remove() # Remove default handler
logger.add(sys.stderr, level="INFO") # Add console handler
logger.add(log_file, rotation="10 MB", retention="10 days", level="DEBUG") # Add file handler

def get_logger():
    return logger
