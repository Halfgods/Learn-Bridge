#!/bin/bash
# only for Gnome 
# Frontend
gnome-terminal -- bash -c "cd Frontend && npm run dev; exec bash"

# Backend API
gnome-terminal -- bash -c "cd Backend && source .venv/bin/activate && python3 main.py; exec bash"

# Scrapper
gnome-terminal -- bash -c "cd Backend/Scrapper && source .venv/bin/activate && python3 main.py; exec bash"

# Chatbot LLM
gnome-terminal -- bash -c "cd Backend && source .venv/bin/activate && cd Chatbot_LLM && python3 main.py; exec bash"