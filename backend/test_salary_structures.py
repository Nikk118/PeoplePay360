import json
import urllib.request
import urllib.error
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        parsed = json.loads(body) if body else None
        return e.code, parsed

def test_salary_structures():
    print("--- 1. Authenticating as Admin ---")
    status_code, data = make_request(f"{BASE_URL}/auth/login", method="POST", data={"email": "admin@peoplepay360.com", "password": "Password123!"})
    if status_code != 200:
        print(f"FAILED to login: {status_code} {data}")
        sys.exit(1)
    
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in successfully!")

    print("\n--- 2. Fetching Salary Structures ---")
    status_code, structures = make_request(f"{BASE_URL}/salary-structures", headers=headers)
    assert status_code == 200, f"Expected 200, got {status_code}: {structures}"
    print(f"Found {len(structures)} structure(s).")
    assert len(structures) >= 1, "Expected at least 1 structure (Regular Salary Structure)"

    reg_struct = next((s for s in structures if s["name"] == "Regular Salary Structure"), None)
    assert reg_struct is not None, "Regular Salary Structure not found!"
    print(f"Regular Salary Structure ID: {reg_struct['id']}")
    print(f"Rule count: {reg_struct['rule_count']}")

    print("\n--- 3. Verifying Seeded Rules & Sequence Order ---")
    rules = reg_struct["rules"]
    assert len(rules) == 9, f"Expected 9 rules in Regular Salary Structure, got {len(rules)}"
    
    sequences = [r["sequence"] for r in rules]
    codes = [r["code"] for r in rules]
    print("Rule codes in order:", codes)
    print("Rule sequences:", sequences)

    assert sequences == sorted(sequences), "Rules are NOT returned in sequence order!"
    expected_codes = ["BASIC", "HRA", "MA", "TA", "GROSS", "PF", "TAX", "UPL", "NET"]
    assert codes == expected_codes, f"Expected codes {expected_codes}, got {codes}"
    print("[OK] All 9 rules present and returned in correct sequence order!")

    print("\n--- 4. Creating a New Salary Structure & Rules ---")
    new_struct_payload = {
        "name": "Executive Salary Structure",
        "description": "Structure for C-level executives",
        "active": True
    }
    status_code, new_struct = make_request(f"{BASE_URL}/salary-structures", method="POST", data=new_struct_payload, headers=headers)
    assert status_code == 201, f"Failed to create structure: {new_struct}"
    new_struct_id = new_struct["id"]
    print(f"Created structure '{new_struct['name']}' with ID {new_struct_id}")

    print("\n--- 5. Creating a Rule in Executive Structure ---")
    rule_payload = {
        "structure_id": new_struct_id,
        "name": "Executive Bonus",
        "code": "BONUS",
        "category": "allowance",
        "sequence": 15,
        "computation_type": "fixed",
        "fixed_amount": 10000.0,
        "active": True,
        "appears_on_payslip": True
    }
    status_code, created_rule = make_request(f"{BASE_URL}/salary-rules", method="POST", data=rule_payload, headers=headers)
    assert status_code == 201, f"Failed to create rule: {created_rule}"
    print(f"Created rule '{created_rule['name']}' (Code: {created_rule['code']})")

    print("\n--- 6. Testing Duplicate Rule Code Rejection ---")
    dup_payload = {
        "structure_id": new_struct_id,
        "name": "Another Bonus",
        "code": "bonus",  # lowercase of BONUS
        "category": "allowance",
        "sequence": 25,
        "computation_type": "fixed",
        "fixed_amount": 5000.0
    }
    status_code, dup_res = make_request(f"{BASE_URL}/salary-rules", method="POST", data=dup_payload, headers=headers)
    assert status_code == 400, f"Expected 400 for duplicate code, got {status_code}: {dup_res}"
    print(f"[OK] Duplicate rule code correctly rejected! Message: {dup_res['detail']}")

    print("\n--- 7. Updating & Deleting Rule ---")
    rule_id = created_rule["id"]
    status_code, update_res = make_request(f"{BASE_URL}/salary-rules/{rule_id}", method="PUT", data={"fixed_amount": 15000.0, "sequence": 12}, headers=headers)
    assert status_code == 200
    assert update_res["fixed_amount"] == 15000.0
    print("Rule updated successfully!")

    status_code, del_rule_res = make_request(f"{BASE_URL}/salary-rules/{rule_id}", method="DELETE", headers=headers)
    assert status_code == 200
    print("Rule deleted successfully!")

    print("\n--- 8. Deleting Executive Structure ---")
    status_code, del_struct_res = make_request(f"{BASE_URL}/salary-structures/{new_struct_id}", method="DELETE", headers=headers)
    assert status_code == 200
    print("Executive structure deleted successfully!")

    print("\n--- 9. Safe Delete Protection Test ---")
    # Attempting to delete Regular Salary Structure (used in contracts)
    status_code, safe_del_res = make_request(f"{BASE_URL}/salary-structures/{reg_struct['id']}", method="DELETE", headers=headers)
    assert status_code == 400, f"Expected 400 when deleting structure in use, got {status_code}"
    print(f"[OK] In-use structure deletion correctly prevented! Message: {safe_del_res['detail']}")

    print("\n==========================================")
    print("ALL SALARY STRUCTURE & RULE BACKEND TESTS PASSED SUCCESSFULLY!")
    print("==========================================")

if __name__ == "__main__":
    test_salary_structures()
