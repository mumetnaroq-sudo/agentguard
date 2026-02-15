"""
AgentGuard Test Suite Runner
Runs all test scenarios and reports results.
"""

import sys
import subprocess
from pathlib import Path


def run_test(test_file: str, description: str) -> bool:
    """Run a single test file"""
    
    print("\n" + "="*70)
    print(f"RUNNING: {description}")
    print("="*70)
    
    test_path = Path(__file__).parent / test_file
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_path)],
            capture_output=False,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print(f"\n✅ {description} PASSED")
            return True
        else:
            print(f"\n❌ {description} FAILED")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"\n⏱️ {description} TIMEOUT")
        return False
    except Exception as e:
        print(f"\n💥 {description} ERROR: {e}")
        return False


def main():
    """Run all tests"""
    
    print("\n" + "🧪"*35)
    print("AGENTGUARD SECURITY TEST SUITE")
    print("🧪"*35)
    
    tests = [
        ('test_skill_detection.py', 'Skill Scanner Tests'),
        ('test_behavior_detection.py', 'Behavior Monitor Tests'),
        ('test_integrity_check.py', 'Integrity Checker Tests'),
    ]
    
    results = []
    
    for test_file, description in tests:
        passed = run_test(test_file, description)
        results.append((description, passed))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for description, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {description}")
    
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 All tests passed! AgentGuard is working correctly.")
        return 0
    else:
        print("\n⚠️ Some tests failed. Review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
