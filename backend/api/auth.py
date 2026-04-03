import random
import requests
from twilio.rest import Client
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.security import create_access_token
from database.session import get_db
from models.user import User, OtpSession
from schemas.auth import OtpRequest, OtpVerify, TokenWithUser

router = APIRouter()


def _print_dev_otp_to_terminal(mobile: str, otp_code: str) -> None:
    """Local/Twilio-off mode only: OTP is shown here because SMS is not used."""
    line = "=" * 56
    print(f"\n{line}", flush=True)
    print(f"  DEV OTP CODE:  {otp_code}", flush=True)
    print(f"  mobile:        {mobile}", flush=True)
    print(f"{line}\n", flush=True)


@router.post("/request-otp")
def request_otp(payload: OtpRequest, db: Session = Depends(get_db)):
    mobile = payload.mobile_number.replace("+91", "").replace(" ", "")
    formatted_number = f"+91{mobile}" if len(mobile) == 10 else f"+{mobile}"
    
    # --- OFFLINE / FALLBACK MODE ---
    if not settings.TWILIO_VERIFY_SERVICE_SID or not settings.TWILIO_ACCOUNT_SID:
        otp_code = str(random.randint(100000, 999999))
        _print_dev_otp_to_terminal(mobile, otp_code)
        db.query(OtpSession).filter(OtpSession.mobile_number == mobile).delete()
        session_record = OtpSession(
            mobile_number=mobile,
            otp_code=otp_code,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(session_record)
        db.commit()
        return {"message": "OTP simulated locally."}
    
    # --- TWILIO VERIFY MODE ---
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    try:
        verification = client.verify \
            .v2 \
            .services(settings.TWILIO_VERIFY_SERVICE_SID) \
            .verifications \
            .create(to=formatted_number, channel='sms')
            
        print(f"Twilio Verify API Success! Status: {verification.status} (OTP sent via SMS only; not visible to server)")
        return {"message": "OTP sent successfully via Twilio Verify", "status": verification.status}
    except Exception as e:
        print(f"Twilio Verify API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Twilio Verify Error: {str(e)}")

@router.post("/verify-otp", response_model=TokenWithUser)
def verify_otp(payload: OtpVerify, db: Session = Depends(get_db)):
    mobile = payload.mobile_number.replace("+91", "").replace(" ", "")
    formatted_number = f"+91{mobile}" if len(mobile) == 10 else f"+{mobile}"
    
    # --- OFFLINE / FALLBACK MODE ---
    if not settings.TWILIO_VERIFY_SERVICE_SID or not settings.TWILIO_ACCOUNT_SID:
        session_record = db.query(OtpSession).filter(
            OtpSession.mobile_number == mobile, OtpSession.otp_code == payload.otp_code
        ).first()
        if not session_record:
            raise HTTPException(status_code=400, detail="Invalid Local OTP code.")
        if session_record.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Local OTP has expired.")
        db.delete(session_record)
    
    # --- TWILIO VERIFY MODE ---
    else:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        try:
            verification_check = client.verify \
                .v2 \
                .services(settings.TWILIO_VERIFY_SERVICE_SID) \
                .verification_checks \
                .create(to=formatted_number, code=payload.otp_code)
                
            if verification_check.status != "approved":
                raise HTTPException(status_code=400, detail="Invalid Twilio Verify OTP code.")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=400, detail=f"Twilio Client Error: {str(e)}")
    
    # -- COMMON DB RESOLUTION --
    user = db.query(User).filter(User.mobile_number == mobile).first()
    if not user:
        user = User(mobile_number=mobile, business_name=payload.name)
        db.add(user)
    elif payload.name and not user.business_name:
        user.business_name = payload.name
    
    db.commit()
    db.refresh(user)
        
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "mobile_number": user.mobile_number,
            "business_name": user.business_name,
            "gstin": user.gstin
        }
    }
