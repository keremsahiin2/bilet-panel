#!/bin/bash
BIN_ID="69cef0d036566621a8740cdb"
API_KEY='$2a$10$cip66R4w.2tIzZWE8g9YkO1PUm.m8qnmKKKb0lZFEFGAoXyxqIPZm'

read -p "Tarih gir (örn: 2026-05-21): " DATE

echo ""
echo "O güne ait satışlar:"
curl -s -X GET "https://api.jsonbin.io/v3/b/$BIN_ID/latest" \
  -H "X-Master-Key: $API_KEY" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)['record']
day = d['dailySales'].get('$DATE', {})
if not day:
    print('Bu tarihte kayıt yok.')
else:
    for k,v in day.items():
        print(f'  {k} → {v}')
"

echo ""
read -p "Silinecek kayıt ID (örn: _s_30867, tüm günü silmek için 'tümü'): " KEY

if [ "$KEY" = "tümü" ]; then
  SCRIPT="del d['dailySales']['$DATE']"
else
  SCRIPT="del d['dailySales']['$DATE']['$KEY']"
fi

read -p "Emin misin? (evet/hayır): " CONFIRM
if [ "$CONFIRM" = "evet" ]; then
  curl -s -X GET "https://api.jsonbin.io/v3/b/$BIN_ID/latest" \
    -H "X-Master-Key: $API_KEY" \
    | python3 -c "import json,sys; d=json.load(sys.stdin)['record']; $SCRIPT; print(json.dumps(d))" > /tmp/fixed.json

  curl -s -X PUT "https://api.jsonbin.io/v3/b/$BIN_ID" \
    -H "X-Master-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @/tmp/fixed.json > /dev/null

  echo "✅ Silindi!"
else
  echo "İptal edildi."
fi
