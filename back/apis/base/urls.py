from fastapi import APIRouter

router = APIRouter()


@router.get("/hh")
async def hh():
    return {"ok": True, "app": "ballitas"}
