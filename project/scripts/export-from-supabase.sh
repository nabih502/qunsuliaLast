#!/bin/bash
# ══════════════════════════════════════════════════════
# سكريبت تصدير البيانات من Supabase
# ══════════════════════════════════════════════════════

echo "════════════════════════════════════════"
echo "📦 تصدير البيانات من Supabase"
echo "════════════════════════════════════════"
echo ""

# ════════════════════════════════════════
# المتغيرات المطلوبة
# ════════════════════════════════════════

# ⚠️ احصل على هذه المعلومات من Supabase Dashboard:
# Settings → Database → Connection string

read -p "أدخل Supabase Database Host (مثال: db.xxxxx.supabase.co): " DB_HOST
read -p "أدخل Database Name (عادة: postgres): " DB_NAME
read -p "أدخل Database User (عادة: postgres): " DB_USER
read -sp "أدخل Database Password: " DB_PASSWORD
echo ""

# ════════════════════════════════════════
# اسم ملف Backup
# ════════════════════════════════════════
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="supabase_backup_${TIMESTAMP}.sql"

# ════════════════════════════════════════
# التحقق من pg_dump
# ════════════════════════════════════════
if ! command -v pg_dump &> /dev/null; then
    echo "❌ خطأ: pg_dump غير مثبت"
    echo "ثبت PostgreSQL client أولاً:"
    echo ""
    echo "# Ubuntu/Debian:"
    echo "sudo apt install postgresql-client"
    echo ""
    echo "# Mac:"
    echo "brew install postgresql"
    echo ""
    exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "🚀 بدء التصدير..."
echo "════════════════════════════════════════"
echo ""

# ════════════════════════════════════════
# تصدير البيانات
# ════════════════════════════════════════
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -p 5432 \
    --file="$BACKUP_FILE" \
    --verbose \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists

# ════════════════════════════════════════
# التحقق من النجاح
# ════════════════════════════════════════
if [ $? -eq 0 ]; then
    echo ""
    echo "════════════════════════════════════════"
    echo "✅ تم التصدير بنجاح!"
    echo "════════════════════════════════════════"
    echo "📁 الملف: $BACKUP_FILE"
    echo "📊 الحجم: $(du -h $BACKUP_FILE | cut -f1)"
    echo ""
    echo "════════════════════════════════════════"
    echo "📋 الخطوة التالية:"
    echo "════════════════════════════════════════"
    echo "انقل الملف إلى VPS باستخدام:"
    echo "scp $BACKUP_FILE root@YOUR_VPS_IP:/home/consulate/"
    echo "════════════════════════════════════════"
else
    echo ""
    echo "❌ فشل التصدير!"
    echo "تحقق من:"
    echo "- معلومات الاتصال صحيحة"
    echo "- الإنترنت متصل"
    echo "- Firewall Rules في Supabase"
    exit 1
fi
