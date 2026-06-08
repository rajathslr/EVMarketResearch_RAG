from google_play_scraper import app as gp_app
from google_play_scraper.exceptions import NotFoundError

candidates = {
    "evgo":     ["com.driivz.mobile.android.evgo.driver"],
    "evcs":     ["org.evcs.android"],
    "greenlots": ["com.shell.sitibv.motorist.america"],
    "electrify_america": ["com.electrifyamerica.electricvehicle", "com.blink.ea"],
    "flo":      ["ca.flo.customer", "ca.flo.app"],
}

for name, ids in candidates.items():
    for app_id in ids:
        try:
            info = gp_app(app_id, lang="en", country="us")
            print(f"FOUND  {name}: {app_id}  =>  {info['title']}")
        except NotFoundError:
            print(f"MISS   {name}: {app_id}")
        except Exception as e:
            print(f"ERROR  {name}: {app_id}: {e}")
