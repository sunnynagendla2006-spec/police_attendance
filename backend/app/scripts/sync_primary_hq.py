import asyncio
import motor.motor_asyncio

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["policehq_geoattend"]
    primary = await db.headquarters.find_one({"is_primary": True})
    if not primary:
        active = await db.headquarters.find_one({"status": "ACTIVE"})
        if active:
            await db.headquarters.update_one({"_id": active["_id"]}, {"$set": {"is_primary": True}})
            print(f"Set primary HQ to: {active.get('name')}")
        else:
            # Fallback to any HQ
            any_hq = await db.headquarters.find_one({})
            if any_hq:
                await db.headquarters.update_one({"_id": any_hq["_id"]}, {"$set": {"is_primary": True, "status": "ACTIVE"}})
                print(f"Set primary HQ to: {any_hq.get('name')}")

    hq = await db.headquarters.find_one({"is_primary": True})
    if hq:
        coords = hq.get("location", {}).get("coordinates", [])
        print(f"Primary HQ: {hq.get('name')} @ {coords}, Radius: {hq.get('radius_meters')}m, Status: {hq.get('status')}")

if __name__ == "__main__":
    asyncio.run(main())
