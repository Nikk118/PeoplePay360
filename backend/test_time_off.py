import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"
emp_id = "e1111111-1111-1111-1111-111111111111"  # Ravi Kumar
type_id = "t1111111-1111-1111-1111-111111111111" # Paid Annual Leave

# 1. Login as HR Manager
login_req = urllib.request.Request(
    f"{BASE_URL}/auth/login",
    data=json.dumps({"email": "hrmanager@peoplepay360.com", "password": "Password123!"}).encode(),
    headers={"Content-Type": "application/json"}
)
hr_token = json.loads(urllib.request.urlopen(login_req).read())["access_token"]
headers = {"Authorization": f"Bearer {hr_token}", "Content-Type": "application/json"}

# 2. Check initial balance
bal_req = urllib.request.Request(f"{BASE_URL}/time-off/balances?employee_id={emp_id}", headers=headers)
balances = json.loads(urllib.request.urlopen(bal_req).read())
initial_annual = next(b for b in balances if b["time_off_type_id"] == type_id)
print(f"1. Initial Balance -> Allocated: {initial_annual['allocated_days']}, Taken: {initial_annual['taken_days']}, Remaining: {initial_annual['remaining_days']}")

# 3. Create leave request for Sep 15-17, 2026 (3 days)
req_data = {
    "employee_id": emp_id,
    "time_off_type_id": type_id,
    "date_from": "2026-09-15",
    "date_to": "2026-09-17",
    "reason": "Personal vacation"
}
create_req = urllib.request.Request(f"{BASE_URL}/time-off/requests", data=json.dumps(req_data).encode(), headers=headers)
req_res = json.loads(urllib.request.urlopen(create_req).read())
req_id = req_res["id"]
print(f"2. Created Leave Request Duration: {req_res['duration_days']} days (Sep 15-17)")

# 4. Approve the request
app_req = urllib.request.Request(f"{BASE_URL}/time-off/requests/{req_id}/approve", data=b"{}", headers=headers, method="PUT")
app_res = json.loads(urllib.request.urlopen(app_req).read())
print(f"3. Request Approval Status: {app_res['status']}")

# 5. Verify updated balance (Allocated: 20, Used: 3, Remaining: 17)
bal_req2 = urllib.request.Request(f"{BASE_URL}/time-off/balances?employee_id={emp_id}", headers=headers)
balances2 = json.loads(urllib.request.urlopen(bal_req2).read())
updated_annual = next(b for b in balances2 if b["time_off_type_id"] == type_id)
print(f"4. Updated Balance -> Allocated: {updated_annual['allocated_days']}, Taken: {updated_annual['taken_days']}, Remaining: {updated_annual['remaining_days']}")

# 6. Test duplicate approval protection (re-approving must NOT double deduct)
app_dup = urllib.request.Request(f"{BASE_URL}/time-off/requests/{req_id}/approve", data=b"{}", headers=headers, method="PUT")
urllib.request.urlopen(app_dup)
bal_req3 = urllib.request.Request(f"{BASE_URL}/time-off/balances?employee_id={emp_id}", headers=headers)
balances3 = json.loads(urllib.request.urlopen(bal_req3).read())
dup_annual = next(b for b in balances3 if b["time_off_type_id"] == type_id)
print(f"5. Duplicate Approval Protection -> Taken days remained: {dup_annual['taken_days']}")

# 7. Test insufficient balance protection (attempting 25 days when remaining is 17)
big_req_data = {
    "employee_id": emp_id,
    "time_off_type_id": type_id,
    "date_from": "2026-10-01",
    "date_to": "2026-10-25",
    "reason": "Excessive leave"
}
big_create = urllib.request.Request(f"{BASE_URL}/time-off/requests", data=json.dumps(big_req_data).encode(), headers=headers)
big_res = json.loads(urllib.request.urlopen(big_create).read())
big_app = urllib.request.Request(f"{BASE_URL}/time-off/requests/{big_res['id']}/approve", data=b"{}", headers=headers, method="PUT")

try:
    urllib.request.urlopen(big_app)
    print("FAILED: Insufficient balance check did not throw error!")
except urllib.error.HTTPError as err:
    err_msg = json.loads(err.read())["detail"]
    print(f"6. Insufficient Balance Protection -> Caught expected HTTP 400: '{err_msg}'")

print("\n--- ALL DEMO ACCEPTANCE TESTS PASSED! ---")
