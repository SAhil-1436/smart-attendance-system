#!/usr/bin/env python3
"""
Admin Password & Username Reset Utility
Usage:
    python reset_admin.py --password "NewPassword@123" [--username "admin"]
"""
import sys
import argparse
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash

async def reset_admin(username: str, password: str):
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.role == "ADMIN"))
        admin = res.scalar_one_or_none()
        
        if admin:
            old_user = admin.username
            admin.username = username
            admin.password_hash = get_password_hash(password)
            await session.commit()
            print("========================================")
            print("✓ Admin credentials updated successfully!")
            print(f"  Username: {admin.username} (previously: {old_user})")
            print(f"  Password: {password}")
            print("========================================")
        else:
            admin = User(
                username=username,
                email="admin@college.edu",
                password_hash=get_password_hash(password),
                full_name="System Administrator",
                role="ADMIN",
                is_active=True
            )
            session.add(admin)
            await session.commit()
            print("========================================")
            print("✓ New Admin user created successfully!")
            print(f"  Username: {username}")
            print(f"  Password: {password}")
            print("========================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset or change Admin credentials")
    parser.add_argument("--username", default="admin", help="Admin username (default: admin)")
    parser.add_argument("--password", required=True, help="New Admin password")
    args = parser.parse_args()
    
    asyncio.run(reset_admin(args.username, args.password))
