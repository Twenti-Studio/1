from fastapi import APIRouter, Request, Form, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from typing import Optional
import os
import secrets
from datetime import datetime, timezone, timedelta
from app.main import prisma
from app.services.voucher_service import create_voucher, get_all_vouchers
from app.services.subscription_service import check_ai_credits

router = APIRouter(prefix="/admin", tags=["admin"])
templates = Jinja2Templates(directory="templates")

# Simple admin credentials from ENV
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "finot123")

# In-memory session check
SESSIONS = set()

async def get_current_admin(request: Request):
    session_id = request.cookies.get("admin_session")
    if session_id not in SESSIONS:
        return None
    return ADMIN_USERNAME

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: Optional[str] = None):
    return templates.TemplateResponse("admin_login.html", {"request": request, "error": error})

@router.post("/login")
async def login(response: Response, username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        session_id = secrets.token_hex(16)
        SESSIONS.add(session_id)
        response = RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)
        response.set_cookie(key="admin_session", value=session_id, httponly=True)
        return response
    return RedirectResponse(url="/admin/login?error=Invalid+credentials", status_code=status.HTTP_303_SEE_OTHER)

@router.get("/logout")
async def logout(response: Response):
    response = RedirectResponse(url="/admin/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("admin_session")
    return response

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, admin=Depends(get_current_admin)):
    if not admin:
        return RedirectResponse(url="/admin/login")
    
    # Get users
    users = await prisma.user.find_many(
        order={"createdAt": "desc"}
    )
    
    # Enrich users with credit info
    user_list = []
    for u in users:
        credits = await check_ai_credits(u.id)
        user_list.append({
            "id": str(u.id),
            "username": u.username or "-",
            "display_name": u.displayName,
            "plan": u.plan,
            "credits_remaining": credits["remaining"],
            "credits_total": credits["total"],
            "created_at": u.createdAt
        })
        
    return templates.TemplateResponse("admin_dashboard.html", {
        "request": request, 
        "users": user_list,
        "admin": admin
    })

@router.get("/vouchers", response_class=HTMLResponse)
async def vouchers_page(request: Request, admin=Depends(get_current_admin)):
    if not admin:
        return RedirectResponse(url="/admin/login")
        
    vouchers = await prisma.voucher.find_many(
        order={"createdAt": "desc"}
    )
    return templates.TemplateResponse("admin_vouchers.html", {
        "request": request,
        "vouchers": vouchers,
        "admin": admin
    })

@router.post("/vouchers/create")
async def create_new_voucher(
    request: Request,
    target: str = Form(None),
    plan: str = Form(...),
    duration: int = Form(...),
    admin=Depends(get_current_admin)
):
    if not admin:
        return RedirectResponse(url="/admin/login")
        
    await create_voucher(plan=plan, duration_days=duration, target_user=target)
    return RedirectResponse(url="/admin/vouchers", status_code=status.HTTP_303_SEE_OTHER)
