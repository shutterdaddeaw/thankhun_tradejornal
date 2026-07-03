# Trigger Vercel Auto-Deployment after environment variable setup
import os
import sys

# Add the api directory to python path so app imports resolve correctly
api_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, api_dir)

from app.main import app
