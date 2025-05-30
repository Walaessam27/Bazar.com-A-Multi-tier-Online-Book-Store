import requests
import time
import statistics
import random # سنستخدمه لاختيار أرقام كتب عشوائية

# --- الإعدادات الأساسية ---
BASE_URL_FRONTEND = "http://localhost:3000"  # عنوان الواجهة الأمامية
NUM_REQUESTS_INFO = 30  # عدد طلبات info للاختبار
NUM_REQUESTS_PURCHASE = 10 # عدد طلبات purchase للاختبار
BOOK_IDS_FOR_INFO_TEST = [1, 2, 3, 4, 5, 6, 7] # أرقام كتب موجودة لاختبار info
BOOK_ID_FOR_PURCHASE_TEST = 2 # رقم كتاب لديه مخزون كافٍ لاختبار الشراء

# --- دوال مساعدة ---
def send_request_and_measure_time(method, url, payload=None, headers=None):
    """يرسل طلب HTTP ويقيس زمن الاستجابة بالمللي ثانية."""
    try:
        start_time = time.perf_counter()
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=5)
        elif method.upper() == "POST":
            response = requests.post(url, json=payload, headers=headers, timeout=10)
        else:
            print(f"Unsupported method: {method}")
            return None, None

        end_time = time.perf_counter()
        response_time_ms = (end_time - start_time) * 1000
        
        # طباعة معلومات بسيطة عن الطلب
        # print(f"{method} {url} - Status: {response.status_code}, Time: {response_time_ms:.2f} ms")
        
        response.raise_for_status() # سيثير خطأ إذا كانت الاستجابة 4xx أو 5xx
        return response_time_ms, response.json() # نرجع الزمن والبيانات (إذا كانت JSON)
    
    except requests.exceptions.Timeout:
        print(f"Request TIMEOUT: {method} {url}")
        return None, None
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error: {http_err} for {method} {url} - Response: {http_err.response.text[:100]}") # اطبع أول 100 حرف من الخطأ
        return None, None # أو يمكنكِ إرجاع زمن الخطأ إذا أردتِ
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e} for {method} {url}")
        return None, None

# --- دوال التجارب ---

def measure_average_info_time(book_ids, num_requests, cache_priming_requests=0):
    """يقيس متوسط زمن استجابة طلبات info."""
    response_times_info = []
    print(f"\n--- Measuring average response time for GET /info (Total {num_requests} actual measurement requests) ---")

    # خطوة اختيارية: "تسخين" الكاش إذا أردنا قياس أداء الكاش hit
    if cache_priming_requests > 0 and book_ids:
        print(f"Priming cache with {cache_priming_requests} requests to item {book_ids[0]}...")
        for _ in range(cache_priming_requests):
            send_request_and_measure_time("GET", f"{BASE_URL_FRONTEND}/info/{book_ids[0]}")
            time.sleep(0.05) # تأخير بسيط

    for i in range(num_requests):
        book_id_to_test = random.choice(book_ids) # اختيار كتاب عشوائي من القائمة
        # إذا أردتِ اختبار cache miss دائمًا، تأكدي أن book_id_to_test يتغير ولا يُطلب مرتين
        # أو اطلبي كتابًا لم يتم طلبه من قبل، أو ألغي صلاحية الكاش قبله.
        # الآن، الاختيار العشوائي قد يؤدي لـ hit أو miss.
        
        print(f"INFO Request {i+1}/{num_requests} for item {book_id_to_test}...")
        latency, _ = send_request_and_measure_time("GET", f"{BASE_URL_FRONTEND}/info/{book_id_to_test}")
        if latency is not None:
            response_times_info.append(latency)
        time.sleep(0.1) # تأخير بسيط بين الطلبات

    if response_times_info:
        avg_time = statistics.mean(response_times_info)
        print(f"GET /info - Average Response Time: {avg_time:.2f} ms from {len(response_times_info)} successful requests.")
    else:
        print("GET /info - No successful requests to calculate average.")
    return response_times_info

def measure_average_purchase_time(book_id, num_purchases):
    """يقيس متوسط زمن استجابة طلبات purchase."""
    response_times_purchase = []
    print(f"\n--- Measuring average response time for POST /purchase (Total {num_purchases} requests) ---")
    
    successful_purchases = 0
    for i in range(num_purchases):
        print(f"PURCHASE Request {i+1}/{num_purchases} for item {book_id}...")
        latency, response_data = send_request_and_measure_time("POST", f"{BASE_URL_FRONTEND}/purchase/{book_id}")
        if latency is not None:
            response_times_purchase.append(latency)
            if response_data and "message" in response_data and "successfully" in response_data["message"].lower():
                successful_purchases +=1
        else: # إذا فشل الطلب (timeout أو خطأ آخر)
            print(f"Purchase request {i+1} for item {book_id} failed to get a response time.")
            # قد ترغب في إيقاف الاختبار إذا فشلت عمليات الشراء بشكل متكرر (مثلاً، نفاد المخزون)
            # break 
        time.sleep(0.2) # تأخير أكبر قليلاً لعمليات الشراء

    if response_times_purchase:
        avg_time = statistics.mean(response_times_purchase)
        print(f"POST /purchase - Average Response Time: {avg_time:.2f} ms from {len(response_times_purchase)} attempts ({successful_purchases} successful).")
    else:
        print("POST /purchase - No successful requests to calculate average.")
    return response_times_purchase

def experiment_cache_behavior(book_id):
    """تجربة لإظهار سلوك الكاش وإلغاء الصلاحية."""
    print(f"\n--- Cache Behavior Experiment for item {book_id} ---")
    
    # 1. Info request (likely a miss, populates cache)
    print("Step 1: Initial GET /info (expect miss, prime cache)")
    latency_miss1, data_miss1 = send_request_and_measure_time("GET", f"{BASE_URL_FRONTEND}/info/{book_id}")
    if latency_miss1 is None: print(f"Failed initial info request for item {book_id}"); return
    print(f"Result: {latency_miss1:.2f} ms, Stock: {data_miss1.get('Stock') if data_miss1 else 'N/A'}")


    # 2. Info request (should be a hit)
    print("\nStep 2: Second GET /info (expect hit)")
    latency_hit, data_hit = send_request_and_measure_time("GET", f"{BASE_URL_FRONTEND}/info/{book_id}")
    if latency_hit is None: print(f"Failed second info request (expected hit) for item {book_id}"); return
    print(f"Result: {latency_hit:.2f} ms, Stock: {data_hit.get('Stock') if data_hit else 'N/A'}")

    # 3. Purchase request (triggers invalidation)
    print("\nStep 3: POST /purchase (triggers invalidation)")
    latency_purchase, data_purchase = send_request_and_measure_time("POST", f"{BASE_URL_FRONTEND}/purchase/{book_id}")
    if latency_purchase is None: 
        print(f"Purchase failed for item {book_id}. Cannot reliably test post-invalidation miss.")
        if data_purchase and data_purchase.get("message") and "out of stock" in data_purchase.get("message").lower():
            print("Reason: Item is out of stock.")
        return
    print(f"Result: {latency_purchase:.2f} ms, New Stock (from purchase response): {data_purchase.get('new_stock') if data_purchase else 'N/A'}")
    
    time.sleep(0.5) # نعطي وقتًا بسيطًا لطلب الإلغاء ليصل ويُعالج

    # 4. Info request (should be a miss again)
    print("\nStep 4: GET /info after purchase (expect miss due to invalidation)")
    latency_miss2, data_miss2 = send_request_and_measure_time("GET", f"{BASE_URL_FRONTEND}/info/{book_id}")
    if latency_miss2 is None: print(f"Failed info request (expected miss) for item {book_id} after purchase"); return
    print(f"Result: {latency_miss2:.2f} ms, Stock: {data_miss2.get('Stock') if data_miss2 else 'N/A'}")

    print("\nCache Behavior Experiment Summary:")
    print(f"  Latency - Initial Miss: {latency_miss1:.2f} ms")
    print(f"  Latency - Cache Hit:    {latency_hit:.2f} ms")
    print(f"  Latency - Purchase:     {latency_purchase:.2f} ms")
    print(f"  Latency - Post-Invalidation Miss: {latency_miss2:.2f} ms")
    
    if latency_hit is not None and latency_miss1 is not None:
        print(f"Caching reduced latency by approx: {(latency_miss1 - latency_hit):.2f} ms ({( (latency_miss1 - latency_hit) / latency_miss1 * 100) if latency_miss1 > 0 else 0 :.1f}%)")


# --- تشغيل التجارب ---
if __name__ == "__main__":
    print("===== Starting Performance Tests =====")
    print(f"Targeting Frontend at: {BASE_URL_FRONTEND}")

    # تأكدي من أن الخدمات تعمل قبل تشغيل السكربت
    # وأن الكتب المستخدمة للاختبار موجودة ولديها مخزون (خاصة لاختبار الشراء)

    # 1. متوسط زمن استجابة INFO
    # لقياس "بدون كاش" بشكل أفضل، يمكنكِ إما:
    #    أ) تعطيل الكاش في الواجهة الأمامية مؤقتًا وتشغيل measure_average_info_time.
    #    ب) أو، التأكد من أن كل طلب في measure_average_info_time هو لـ item_id مختلف لم يتم طلبه من قبل.
    # الآن، measure_average_info_time سيظهر سلوكًا مختلطًا إذا كان الكاش مفعلًا.
    # لتقدير "بدون كاش"، يمكننا أخذ متوسط أول طلب لكل عنصر في تجربة الكاش.
    
    # دعنا نقيس أداء الكاش أولاً
    print("\n\n======== Testing INFO requests with Cache ENABLED in Frontend ========")
    # "تسخين" الكاش أولاً (نرسل طلبات لضمان أن العناصر في الكاش للطلبات اللاحقة)
    measure_average_info_time(BOOK_IDS_FOR_INFO_TEST, num_requests=5, cache_priming_requests=NUM_REQUESTS_INFO // 2) # تسخين بنصف عدد الطلبات
    print("\n--- Subsequent INFO requests (should be mostly cache hits) ---")
    info_times_with_cache = measure_average_info_time(BOOK_IDS_FOR_INFO_TEST, num_requests=NUM_REQUESTS_INFO)


    # لقياس "بدون كاش":
    # الخيار 1: قومي بتعليق (comment out) منطق الكاش في frontend_server/app.js، أعيدي بناء الواجهة الأمامية، ثم شغلي:
    # print("\n\n======== Testing INFO requests with Cache DISABLED in Frontend (Manual Change Required) ========")
    # info_times_without_cache_disabled = measure_average_info_time(BOOK_IDS_FOR_INFO_TEST, num_requests=NUM_REQUESTS_INFO)
    
    # الخيار 2: محاكاة miss عن طريق طلب عناصر مختلفة دائمًا (يتطلب قائمة كبيرة من العناصر أو تعديل للدالة)
    # أو استخدام نتائج "latency_miss1" و "latency_miss2" من experiment_cache_behavior كأمثلة لـ cache miss.

    # 2. متوسط زمن استجابة PURCHASE
    print("\n\n======== Testing PURCHASE requests ========")
    # تأكدي أن BOOK_ID_FOR_PURCHASE_TEST لديه مخزون كافٍ لـ NUM_REQUESTS_PURCHASE
    # أو قومي بإعادة تهيئة قاعدة البيانات بين مجموعات اختبار الشراء الكبيرة
    purchase_times = measure_average_purchase_time(BOOK_ID_FOR_PURCHASE_TEST, NUM_REQUESTS_PURCHASE)
    
    # 3. تجربة سلوك الكاش وإلغاء الصلاحية
    print("\n\n======== Cache Invalidation Behavior Experiment ========")
    # تأكدي أن هذا الكتاب لديه مخزون >= 1
    experiment_cache_behavior(BOOK_ID_FOR_PURCHASE_TEST if BOOK_ID_FOR_PURCHASE_TEST != 1 else 3) # استخدمي كتابًا مختلفًا إذا كان الأول قد نفد مخزونه

    print("\n===== Performance Tests Finished =====")