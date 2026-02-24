from typing import AsyncGenerator
from prisma import Prisma

# Singleton Prisma client
prisma = Prisma()


async def connect_db() -> None:
    """Connect ke database."""
    await prisma.connect()


async def get_db() -> AsyncGenerator[Prisma, None]:
    """Dependency async untuk FastAPI."""
    yield prisma
