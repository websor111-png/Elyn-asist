#!/usr/bin/env python3
"""
Backend API Testing for Ely/Elyn Voice Assistant
Tests all required endpoints as specified in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://phone-customizer-11.preview.emergentagent.com/api"

def test_api_info():
    """Test GET /api/ - Should return API info with message and version"""
    print("\n=== Testing GET /api/ ===")
    try:
        response = requests.get(f"{BACKEND_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "version" in data:
                print("✅ API info endpoint working correctly")
                return True
            else:
                print("❌ Missing required fields (message, version)")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing API info: {e}")
        return False

def test_greeting():
    """Test GET /api/greeting - Should return greeting with voice_name, voice_type, and language"""
    print("\n=== Testing GET /api/greeting ===")
    try:
        response = requests.get(f"{BACKEND_URL}/greeting")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["greeting", "voice_name", "voice_type", "language"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                print("✅ Greeting endpoint working correctly")
                print(f"   Voice Name: {data['voice_name']}")
                print(f"   Voice Type: {data['voice_type']}")
                print(f"   Language: {data['language']}")
                return True
            else:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing greeting: {e}")
        return False

def test_get_settings():
    """Test GET /api/settings - Should return user settings"""
    print("\n=== Testing GET /api/settings ===")
    try:
        response = requests.get(f"{BACKEND_URL}/settings")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["voice_type", "voice_name", "preferred_language"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                print("✅ Settings GET endpoint working correctly")
                return True, data
            else:
                print(f"❌ Missing required fields: {missing_fields}")
                return False, None
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error testing get settings: {e}")
        return False, None

def test_update_settings():
    """Test PUT /api/settings - Update settings with voice_type: 'male' and verify voice_name changes to 'Elyn'"""
    print("\n=== Testing PUT /api/settings ===")
    try:
        # First get current settings
        current_success, current_settings = test_get_settings()
        if not current_success:
            print("❌ Cannot test PUT settings - GET settings failed")
            return False
        
        print(f"Current voice_type: {current_settings.get('voice_type')}")
        print(f"Current voice_name: {current_settings.get('voice_name')}")
        
        # Update to male voice
        update_data = {"voice_type": "male"}
        response = requests.put(f"{BACKEND_URL}/settings", json=update_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("voice_type") == "male" and data.get("voice_name") == "Elyn":
                print("✅ Settings UPDATE endpoint working correctly")
                print(f"   Voice changed to: {data['voice_name']} ({data['voice_type']})")
                return True
            else:
                print(f"❌ Voice type/name not updated correctly. Got: {data.get('voice_type')}/{data.get('voice_name')}")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing update settings: {e}")
        return False

def test_voice_command_romanian():
    """Test POST /api/voice/command with Romanian text"""
    print("\n=== Testing POST /api/voice/command (Romanian) ===")
    try:
        test_data = {"text": "Ce oră este?"}
        response = requests.post(f"{BACKEND_URL}/voice/command", json=test_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["response_text", "detected_language", "action_type"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                if data.get("detected_language") == "ro" and data.get("action_type") == "time":
                    print("✅ Romanian voice command working correctly")
                    print(f"   Detected Language: {data['detected_language']}")
                    print(f"   Action Type: {data['action_type']}")
                    return True
                else:
                    print(f"❌ Incorrect language detection or action type")
                    print(f"   Expected: ro/time, Got: {data.get('detected_language')}/{data.get('action_type')}")
                    return False
            else:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing Romanian voice command: {e}")
        return False

def test_voice_command_english():
    """Test POST /api/voice/command with English text"""
    print("\n=== Testing POST /api/voice/command (English) ===")
    try:
        test_data = {"text": "Hello, what time is it?"}
        response = requests.post(f"{BACKEND_URL}/voice/command", json=test_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["response_text", "detected_language", "action_type"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                if data.get("detected_language") == "en" and data.get("action_type") == "time":
                    print("✅ English voice command working correctly")
                    print(f"   Detected Language: {data['detected_language']}")
                    print(f"   Action Type: {data['action_type']}")
                    return True
                else:
                    print(f"❌ Incorrect language detection or action type")
                    print(f"   Expected: en/time, Got: {data.get('detected_language')}/{data.get('action_type')}")
                    return False
            else:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing English voice command: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Ely/Elyn Voice Assistant API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    tests = [
        ("API Info", test_api_info),
        ("Greeting", test_greeting),
        ("Get Settings", lambda: test_get_settings()[0]),
        ("Update Settings", test_update_settings),
        ("Voice Command (Romanian)", test_voice_command_romanian),
        ("Voice Command (English)", test_voice_command_english),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed > 0:
        print("\n⚠️  Some tests failed. Check the detailed output above.")
        sys.exit(1)
    else:
        print("\n🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()