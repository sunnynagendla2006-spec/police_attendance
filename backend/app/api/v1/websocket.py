import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Real-Time WebSockets"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket endpoint for Admin Web Console.
    Streams live officer movements, headquarters entry/exit events,
    stale location transitions, and geofence updates.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep alive and receive any client ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)
