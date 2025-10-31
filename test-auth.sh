#!/bin/bash

echo "🧪 TinyForm Authentication Test Suite"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:8787/api/v1"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"

echo -e "${BLUE}📝 Test 1: Health Check${NC}"
echo "Testing API health..."
HEALTH=$(curl -s $API_URL/../health | python3 -m json.tool 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API is healthy${NC}"
    echo "$HEALTH"
else
    echo -e "${RED}❌ API is not responding${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}📝 Test 2: User Registration${NC}"
echo "Registering user: $TEST_EMAIL"
SIGNUP_RESPONSE=$(curl -s -X POST $API_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"Test User\"}")

if echo "$SIGNUP_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Registration successful${NC}"
    TOKEN=$(echo "$SIGNUP_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
    echo "Token received (first 20 chars): ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ Registration failed${NC}"
    echo "$SIGNUP_RESPONSE"
fi
echo ""

echo -e "${BLUE}📝 Test 3: User Login${NC}"
echo "Logging in with correct password..."
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/auth/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Login successful${NC}"
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "$LOGIN_RESPONSE"
fi
echo ""

echo -e "${BLUE}📝 Test 4: Login with Wrong Password${NC}"
echo "Attempting login with incorrect password..."
FAIL_RESPONSE=$(curl -s -X POST $API_URL/auth/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"WrongPassword123\"}")

if echo "$FAIL_RESPONSE" | grep -q "401"; then
    echo -e "${GREEN}✅ Correctly rejected invalid password${NC}"
else
    echo -e "${RED}❌ Security issue: Invalid password was accepted${NC}"
fi
echo ""

echo -e "${BLUE}📝 Test 5: Duplicate Registration${NC}"
echo "Attempting to register same email again..."
DUP_RESPONSE=$(curl -s -X POST $API_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"Test User\"}")

if echo "$DUP_RESPONSE" | grep -q "already exists"; then
    echo -e "${GREEN}✅ Correctly prevented duplicate registration${NC}"
else
    echo -e "${RED}❌ Duplicate registration was allowed${NC}"
fi
echo ""

echo "======================================"
echo -e "${GREEN}🎉 Testing Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000/auth/signin in your browser"
echo "2. Sign in with:"
echo "   Email: $TEST_EMAIL"
echo "   Password: $TEST_PASSWORD"
echo "3. Test the form builder at http://localhost:3000/form-builder"