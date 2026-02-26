"""
FiNot Entry Point
━━━━━━━━━━━━━━━━━
Main entry point - starts Uvicorn server.
"""

import asyncio
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Start FiNot server."""
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting FiNot on {host}:{port}")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level="info",
        reload=os.getenv("DEPLOYMENT_ENV", "development") == "development",
    )


if __name__ == "__main__":
    main()
