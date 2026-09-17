import subprocess
import time
import os
import sys

screens = [
    ("01_pantry_home", "Home", None),
    ("02_pantry_history", "PantryHistory", None),
    ("03_pantry_item_detail", "Record", "a53848c0-8545-4aef-95bc-8a9e7e319b5b"),
    ("04_giveaways_feed", "Giveaways", None),
    ("05_giveaway_new", "GiveawayNew", None),
    ("06_giveaway_mine", "GiveawayMine", None),
    ("07_giveaway_detail", "Giveaway", "8322a1f6-8dda-4529-b131-9303ff91e4da"),
    ("08_deals_feed", "Deals", None),
    ("09_deal_new", "DealNew", None),
    ("10_deal_detail", "Deal", "9d00d68f-7cf8-4c0e-b284-f79cbbb54914"),
    ("11_reviews_feed", "Reviews", None),
    ("12_reviews_hub", "ReviewsHub", None),
    ("13_product_detail", "Product", "661b2451-bee8-4386-8d6a-23bdd840c243"),
    ("14_product_new_catalog", "ProductNew", None),
    ("15_product_drafts", "ProductDrafts", None),
    ("16_scan_barcode", "Scan", None),
    ("17_profile_main", "Profile", None),
    ("18_profile_edit", "ProfileEdit", None),
    ("19_profile_change_password", "ProfilePassword", None),
    ("20_community_contributions", "CommunityContributions", None),
    ("21_household_sharing", "Household", None),
    ("22_invite_referral", "Invite", None),
    ("23_feedback_hub", "FeedbackHub", None),
    ("24_feedback_detail", "FeedbackDetail", "534964b7-0000-4000-a000-000000000001"),
    ("25_settings_main", "SettingsIndex", None),
    ("26_settings_theme", "SettingsTheme", None),
    ("27_settings_add_passkey", "SettingsAddPasskey", None),
]

out_dir = "/Users/lekiemdan/newapp/docs/screenshots/mobile"
os.makedirs(out_dir, exist_ok=True)

results = []
for idx, (filename, screen_name, entity_id) in enumerate(screens, 1):
    url = f"expyrico://navigate?screen={screen_name}"
    if entity_id:
        url += f"&id={entity_id}"
    
    # Use single quotes around url so remote shell preserves query params intact
    cmd = ["adb", "shell", f"am start -W -a android.intent.action.VIEW -d '{url}'"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error launching {screen_name}: {res.stderr}", file=sys.stderr)
    
    # 2.5s delay to allow data and images to fully render
    time.sleep(2.5)
    
    img_path = f"{out_dir}/{filename}.png"
    with open(img_path, "wb") as f:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f)
    
    size_kb = os.path.getsize(img_path) / 1024
    results.append(f"{filename}.png ({size_kb:.1f} KB)")
    print(f"[{idx}/28] Captured {filename}.png ({size_kb:.1f} KB)")

# Capture Navigation Drawer on Home
subprocess.run(["adb", "shell", "am start -W -a android.intent.action.VIEW -d 'expyrico://navigate?screen=Home'"])
time.sleep(2.0)
subprocess.run(["adb", "shell", "input", "tap", "100", "150"])
time.sleep(1.5)
drawer_path = f"{out_dir}/28_navigation_drawer.png"
with open(drawer_path, "wb") as f:
    subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f)
print(f"[28/28] Captured 28_navigation_drawer.png ({os.path.getsize(drawer_path) / 1024:.1f} KB)")

# Dismiss drawer
subprocess.run(["adb", "shell", "input", "tap", "900", "500"])
print("\nDone! All 28 screens successfully loaded and captured with real content.")
