// =============================================
//  ADVANCED FOOD SYSTEM - script.js
// =============================================

document.addEventListener('DOMContentLoaded', function () {

    let dataset = [];
    const encoders = {};
    window.addEventListener('scroll', function() {
    var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    var scrolled = (winScroll / height) * 100;
    if(el('progressBar')) el('progressBar').style.width = scrolled + "%";
});

    const additiveWatchlist = {
        "E102": "Tartrazine (colour)", "E110": "Sunset Yellow", "E122": "Carmoisine",
        "E124": "Ponceau 4R", "E129": "Allura Red", "E211": "Sodium Benzoate",
        "E221": "Sodium Sulfite", "E249": "Potassium Nitrite", "E250": "Sodium Nitrite",
        "E621": "Monosodium Glutamate (MSG)", "E330": "Citric Acid",
        "E202": "Potassium Sorbate", "E440": "Pectin"
    };

    const commonAllergens = [
        "milk", "peanut", "groundnut", "soy", "soya", "egg", "wheat",
        "gluten", "almond", "cashew", "tree nut", "sesame", "fish", "shellfish", "mustard"
    ];

    const tempRanges = {
        "Dairy": [1, 5], "Meat & Poultry": [-2, 4], "Seafood": [0, 4],
        "Fresh Produce": [2, 8], "Beverage": [2, 8], "Bakery": [15, 25],
        "Frozen Food": [-25, -18], "Baby Food": [1, 5],
        "Packaged Snack": [15, 30], "Street Food": [60, 100]
    };

    const validFoodKeywords = [
        "chips", "biscuit", "milk", "cheese", "yogurt", "meat", "chicken",
        "fish", "vegetable", "fruit", "juice", "tea", "coffee", "bread",
        "cake", "ice cream", "dal", "rice", "snack", "sauce", "oil", "butter", "paneer"
    ];

    const harmfulWords = ["preservative", "artificial", "synthetic", "flavour enhancer"];

    var el = function (id) { return document.getElementById(id); };
    var numVal = function (id) { var e = el(id); if (!e) return null; var v = parseFloat(e.value); return isNaN(v) ? null : v; };
    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
    function todayISO() { return new Date().toISOString().slice(0, 10); }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

    function getDefaultParams(category) {
        var d = {
            "Dairy": { ph: 6.5, moisture: 80, tmin: 1, tmax: 5 },
            "Packaged Snack": { ph: 5.5, moisture: 5, tmin: 15, tmax: 30 },
            "Meat & Poultry": { ph: 6.0, moisture: 70, tmin: -2, tmax: 4 },
            "Seafood": { ph: 6.2, moisture: 75, tmin: 0, tmax: 4 },
            "Fresh Produce": { ph: 5.5, moisture: 85, tmin: 2, tmax: 8 },
            "Beverage": { ph: 3.5, moisture: 90, tmin: 2, tmax: 8 },
            "Bakery": { ph: 6.0, moisture: 35, tmin: 15, tmax: 25 },
            "Frozen Food": { ph: 6.0, moisture: 60, tmin: -25, tmax: -18 },
            "Baby Food": { ph: 5.0, moisture: 80, tmin: 1, tmax: 5 },
            "Street Food": { ph: 5.8, moisture: 50, tmin: 60, tmax: 100 }
        };
        return d[category] || { ph: 6, moisture: 50, tmin: 5, tmax: 25 };
    }

    function autoEncode(value, colIndex) {
        if (!isNaN(value)) return parseFloat(value);
        if (!encoders[colIndex]) encoders[colIndex] = {};
        if (!(value in encoders[colIndex])) encoders[colIndex][value] = Object.keys(encoders[colIndex]).length;
        return encoders[colIndex][value];
    }

    function resetEncoders() { for (var k in encoders) delete encoders[k]; }

    function loadDataset(file) {
        resetEncoders();
        var reader = new FileReader();
        reader.onload = function (e) {
            var lines = e.target.result.split('\n');
            var header = lines[0].split(',');
            var rows = lines.slice(1).map(r => r.split(','));
            dataset = rows.map(function (r) { var c = r; return c.map(function (v, i) { return autoEncode((v||'').trim(), i); }); }).filter(function (r) { return !r.some(isNaN); });
            alert("Loaded: " + dataset.length + " samples");
            // Auto-run EDA analysis and show result
            if (typeof runEDA === 'function') {
                runEDA();
            }
            // Show batch analysis for all rows
            showCSVBatchAnalysis(rows);
        };
        reader.readAsText(file);
    }

    function validateInputs() {
        ['p_name', 'p_exp', 'fssai', 'lab_data', 'lab_limit'].forEach(function (id) {
            var elem = el(id); if (!elem) return;
            if (!elem.value || (id === 'fssai' && !/^\d{14}$/.test(elem.value)) || (id === 'lab_data' && !parseCSVNums(elem.value).length)) elem.classList.add('invalid');
            else elem.classList.remove('invalid');
        });
    }

    function parseCSVNums(s) { var n = s.split(/[,\s]+/).map(function (x) { return Number(x); }).filter(function (x) { return !isNaN(x); }); return n.length >= 2 ? n : []; }

    function nutritionTraffic(p) {
        var out = {};
        if (p.sugar == null) out.sugar = { level: 'NA', text: '—' };
        else { var l = p.sugar > 22.5 ? 'high' : (p.sugar > 5 ? 'med' : 'low'); out.sugar = { level: l, text: p.sugar + ' g/100g' }; }
        if (p.sodium == null) out.sodium = { level: 'NA', text: '—' };
        else { var l = p.sodium > 800 ? 'high' : (p.sodium > 300 ? 'med' : 'low'); out.sodium = { level: l, text: p.sodium + ' mg/100g' }; }
        if (p.sat == null) out.sat = { level: 'NA', text: '—' };
        else { var l = p.sat > 5 ? 'high' : (p.sat > 1.5 ? 'med' : 'low'); out.sat = { level: l, text: p.sat + ' g/100g' }; }
        if (p.trans == null) out.trans = { level: 'NA', text: '—' };
        else { var l = p.trans > 0 ? 'high' : 'low'; out.trans = { level: l, text: p.trans + ' g/100g' }; }
        return out;
    }

    function generateFOPWarnings(sugar, sodium, sat, kcal) {
        var w = [];
        if (sugar !== null && kcal) { var e = (sugar * 4 / kcal) * 100; if (e > 12) w.push("HIGH SUGAR ⚠️"); else if (e > 7.5) w.push("MEDIUM SUGAR"); }
        if (sodium !== null && kcal) { if (sodium > 800) w.push("VERY HIGH SODIUM ⚠️"); else if (sodium > 400) w.push("MEDIUM SODIUM"); }
        if (sat !== null && kcal) { var e = (sat * 9 / kcal) * 100; if (e > 12) w.push("HIGH SATURATED FAT ⚠️"); else if (e > 8) w.push("MEDIUM SATURATED FAT"); }
        return w;
    }

    function baseRiskByCategory(cat) {
        var m = { "Packaged Snack": 20, "Dairy": 40, "Meat & Poultry": 60, "Seafood": 65, "Fresh Produce": 25, "Beverage": 25, "Bakery": 30, "Frozen Food": 35, "Baby Food": 55, "Street Food": 70 };
        return m[cat] || 30;
    }

    function analyze() {
        validateInputs();
        var name = el('p_name') ? el('p_name').value.trim() : '';
        var cat = el('p_cat') ? el('p_cat').value : '';
        var exp = el('p_exp') ? el('p_exp').value : '';
        var ing = el('p_ing') ? el('p_ing').value.toLowerCase() : '';
        var origin = el('p_origin') ? el('p_origin').value : '';
        var fssai = el('fssai') ? el('fssai').value.trim() : '';
        var tmin = numVal('t_min'), tmax = numVal('t_max');
        var dp = getDefaultParams(cat);
        if (tmin === null) tmin = dp.tmin;
        if (tmax === null) tmax = dp.tmax;
        var sugar = numVal('n_sugar'), sodium = numVal('n_sodium'), sat = numVal('n_sat'), trans = numVal('n_trans'), kcal = numVal('n_kcal');
        var notes = [], score = baseRiskByCategory(cat);

        if (!name || !validFoodKeywords.some(function (k) { return name.toLowerCase().includes(k); })) { notes.push('Invalid product name.'); score += 5; }

        var expStatus = 'Not set';
        if (exp) { var d = new Date(exp), now = new Date(), days = Math.floor((d - now) / (1000 * 3600 * 24)); if (days < 0) { expStatus = 'Expired (' + Math.abs(days) + ' days ago)'; score += 40; } else if (days <= 3) { expStatus = 'Near expiry (' + days + ' days)'; score += 15; } else expStatus = 'OK (' + days + ' days left)'; }
        else { notes.push('Expiry not provided; risk +5'); score += 5; }

        var allergenCount = 0, additiveCount = 0, addFlags = [];
        if (ing) {
            for (var i = 0; i < commonAllergens.length; i++) if (ing.includes(commonAllergens[i])) allergenCount++;
            var em = (ing.match(/e\s?\d{3}/gi) || []).map(function (x) { return x.toUpperCase().replace(/\s/g, ''); });
            for (var j = 0; j < em.length; j++) if (additiveWatchlist[em[j]]) { additiveCount++; addFlags.push(em[j] + ': ' + additiveWatchlist[em[j]]); }
        }
        if (allergenCount > 0) { score += 8; notes.push(allergenCount + ' allergen(s) detected.'); }
        if (additiveCount > 0) { score += additiveCount * 4; notes.push('Additives: ' + addFlags.join('; ')); }
        harmfulWords.forEach(function (w) { if (ing.includes(w)) { notes.push('Contains ' + w); score += 5; } });

        if (!fssai) { notes.push("No FSSAI"); score += 5; } else if (!/^\d{14}$/.test(fssai)) { notes.push("Invalid FSSAI"); score += 10; } else notes.push("FSSAI valid");

        var originStatus = 'Not set';
        if (origin === 'India') { originStatus = 'India'; } else if (origin === 'Imported') { score += 5; originStatus = 'Imported'; } else { score += 3; originStatus = 'Other'; }

        var nut = nutritionTraffic({ sugar: sugar, sodium: sodium, sat: sat, trans: trans });
        var nutNotes = [];
        for (var k in nut) { if (nut[k].level === 'high') { score += 8; nutNotes.push(k.toUpperCase() + '=HIGH'); } else if (nut[k].level === 'med') { score += 3; nutNotes.push(k.toUpperCase() + '=MED'); } }
        if (nutNotes.length) notes.push('Nutrition: ' + nutNotes.join(' | '));

        var fopW = generateFOPWarnings(sugar, sodium, sat, kcal);
        if (fopW.length) { notes.push('FOP: ' + fopW.join(' | ')); score += fopW.length * 10; }

        var tempStatus = 'Not set';
        if (!isNaN(tmin) && !isNaN(tmax) && tempRanges[cat]) { if (tmin < tempRanges[cat][0] || tmax > tempRanges[cat][1]) { notes.push('Temp out of range for ' + cat); score += 18; tempStatus = 'Out of Range'; } else tempStatus = 'OK'; }

        score = clamp(Math.round(score), 0, 100);
        var verdict = 'Moderate', badge = 'badge-warn';
        if (score <= 30) { verdict = 'Safe'; badge = 'badge-safe'; } else if (score >= 70) { verdict = 'Unsafe'; badge = 'badge-risk'; }

        var breakdown = { Nutrition: nutNotes.length ? nutNotes.length * 8 : 1, Additives: additiveCount * 6 || 1, Expiry: exp ? (expStatus.startsWith('Expired') ? 40 : (expStatus.startsWith('Near') ? 15 : 1)) : 5, Temp: tempStatus === 'Out of Range' ? 18 : 1, Origin: origin === 'India' ? 1 : 5, Base: baseRiskByCategory(cat) };

        if (score > 70) notes.push("⚠️ Avoid consumption"); else if (score > 40) notes.push("⚠️ Consume with caution"); else notes.push("✅ Safe to consume");

        return { name: name, cat: cat, expStatus: expStatus, allergenCount: allergenCount, additiveCount: additiveCount, notes: notes, score: score, badge: badge, verdict: verdict, breakdown: breakdown, originStatus: originStatus, tempStatus: tempStatus, fopWarnings: fopW };
    }

    var riskChart = null, labChart = null;

    function initRiskChart() {
        var c = el('riskChart'); if (!c) return;
        if (riskChart) riskChart.destroy();
        riskChart = new Chart(c.getContext('2d'), { type: 'pie', data: { labels: ['Nutrition', 'Additives', 'Expiry', 'Temp', 'Origin', 'Base'], datasets: [{ data: [1, 1, 1, 1, 1, 1], backgroundColor: ['#16a34a', '#f59e0b', '#f97316', '#ef4444', '#22d3ee', '#60a5fa'] }] }, options: {
             plugins: { 
                legend: { 
                    position: 'bottom',
                labels: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#f1f5f9' : '#0f172a' } 
             } 
            }, maintainAspectRatio: false
         } });
    }

    function initLabChart(mean, limit) {
        mean = mean || 0; limit = limit || 0;
        var c = el('labChart'); if (!c) return;
        if (labChart) labChart.destroy();
        labChart = new Chart(c.getContext('2d'), { type: 'bar', data: { labels: ['Average', 'Safe Limit'], datasets: [{ data: [mean, limit], backgroundColor: ['#16a34a', '#d1d5db'], borderWidth: 1 }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } }, maintainAspectRatio: false } });
    }

    function runChecks() {
        var r = analyze();
        if (el('k_overall')) el('k_overall').textContent = r.score + ' / 100';
        if (el('k_exp')) el('k_exp').textContent = r.expStatus;
        if (el('k_add')) el('k_add').textContent = r.additiveCount;
        if (el('k_all')) el('k_all').textContent = r.allergenCount;
        if (el('k_origin')) el('k_origin').textContent = r.originStatus;
        var ul = el('bullets'); if (ul) { ul.innerHTML = ''; r.notes.forEach(function (n) { var li = document.createElement('li'); li.innerHTML = '<i class="fas fa-info-circle"></i> ' + n; ul.appendChild(li); }); }
        var v = el('verdict'); if (v) { v.textContent = r.verdict + ' (' + r.score + ')'; v.className = 'badge ' + r.badge; }
        var fd = el('fopWarnings'); if (fd) { if (r.fopWarnings.length) { fd.innerHTML = '🚨 ' + r.fopWarnings.join(' • '); fd.style.display = 'block'; } else fd.style.display = 'none'; }
        if (riskChart) { riskChart.data.labels = Object.keys(r.breakdown); riskChart.data.datasets[0].data = Object.values(r.breakdown); riskChart.update(); }
    }

    function saveReview() { var r = analyze(); var a = JSON.parse(localStorage.getItem('fs_reviews_v1') || '[]'); a.unshift({ ts: new Date().toLocaleString(), name: r.name || '?', cat: r.cat, verdict: r.verdict, score: r.score, origin: r.originStatus, notes: r.notes.join(' | ') }); localStorage.setItem('fs_reviews_v1', JSON.stringify(a)); renderHistory(); alert('Saved!'); }

    function downloadHTML() { var r = analyze(); var h = '<html><head><meta charset="utf-8"><title>' + escapeHtml(r.name) + '</title></head><body><h1>Food Review</h1><p>Product: ' + escapeHtml(r.name) + '<br>Category: ' + r.cat + '<br>Verdict: ' + r.verdict + ' — ' + r.score + '/100</p><ul>' + r.notes.map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('') + '</ul></body></html>'; var b = new Blob([h], { type: 'text/html' }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'review.html'; document.body.appendChild(a); a.click(); a.remove(); }

    function downloadPDF() { if (!window.jspdf) { alert('jsPDF not loaded'); return; } var r = analyze(); var doc = new window.jspdf.jsPDF(); doc.setFontSize(14); doc.text('Food Safety Review', 40, 48); doc.setFontSize(11); doc.text('Product: ' + (r.name || '?'), 40, 72); doc.text('Verdict: ' + r.verdict + ' — ' + r.score + '/100', 40, 90); var y = 110; r.notes.forEach(function (n) { doc.text('- ' + n, 48, y); y += 16; }); doc.save('review.pdf'); }

    function knnPredict(sample, k) {
        k = k || 5;
        if (!dataset.length) dataset = [[6.5, 80, 4, 1], [5.5, 5, 25, 0], [6.0, 70, 2, 1], [3.5, 90, 6, 1]];
        var dists = dataset.map(function (r) { return { d: Math.hypot(sample[0] - r[0], sample[1] - r[1], sample[2] - r[2]), label: r[3] }; });
        dists.sort(function (a, b) { return a.d - b.d; });
        return dists.slice(0, k).reduce(function (s, x) { return s + x.label; }, 0) >= (k / 2) ? 1 : 0;
    }

    function stdNormCDF(x) { var t = 1 / (1 + 0.2316419 * Math.abs(x)); var d = 0.3989423 * Math.exp(-x * x / 2); var p = 1 - d * t * (1.330274429 + t * (-1.821255978 + t * (1.781477937 + t * (-0.356563782 + t * 0.319381530)))); return x >= 0 ? p : 1 - p; }

    function studentTCDF(x, v) {
        function betacf(x, a, b) { var MAXIT = 100, EPS = 3e-7, FPMIN = 1e-30, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; var h = d; for (var m = 1, m2 = 2; m <= MAXIT; m++, m2 += 2) { var aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c; if (Math.abs(d * c - 1) < EPS) break; } return h; }
        function gammaln(z) { var cof = [76.18, -86.5, 24.01, -1.23, 0.0012, -5.3e-6]; var x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); var ser = 1.000000000190015; for (var j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; } return -tmp + Math.log(2.5066 * ser / x); }
        function betai(x, a, b) { var bt = (x === 0 || x === 1) ? 0 : Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x)); if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a; else return 1 - bt * betacf(1 - x, b, a) / b; }
        return 0.5 * betai(v / (v + x * x), v / 2, 0.5);
    }

    function runLabTest() {
        var data = parseCSVNums(el('lab_data') ? el('lab_data').value : '');
        var L = parseFloat(el('lab_limit') ? el('lab_limit').value : '');
        var sigma = parseFloat(el('lab_sigma') ? el('lab_sigma').value : '');
        var alpha = parseFloat(el('lab_alpha') ? el('lab_alpha').value : '0.05');
        var out = el('lab_out'), summary = el('lab_summary');
        if (!out) return; out.innerHTML = '';
        if (!data.length || isNaN(L)) { out.innerHTML = '<li>Enter valid data and limit.</li>'; if (summary) { summary.textContent = 'Invalid'; summary.className = 'badge badge-risk'; } return; }
        if (data.length < 2) { out.innerHTML = '<li>Need at least 2 values.</li>'; return; }
        var n = data.length, mean = data.reduce(function (a, b) { return a + b; }, 0) / n;
        var sd = isNaN(sigma) ? Math.sqrt(data.reduce(function (a, x) { return a + (x - mean) * (x - mean); }, 0) / (n - 1)) : sigma;
        var se = sd / Math.sqrt(n), z = (mean - L) / se, useZ = !isNaN(sigma);
        var p = useZ ? (1 - stdNormCDF(z)) : (1 - studentTCDF(z, n - 1));
        if (el('lab_n')) el('lab_n').textContent = n;
        if (el('lab_mean')) el('lab_mean').textContent = mean.toFixed(2);
        if (el('lab_sd')) el('lab_sd').textContent = sd.toFixed(2);
        var dec = p < alpha ? 'Exceeds safe limit — Not Safe.' : 'Within safe limit — Safe.';
        if (summary) { summary.textContent = dec; summary.className = 'badge ' + (p < alpha ? 'badge-risk' : 'badge-safe'); }
        ['Test: ' + (useZ ? 'Z-Test' : 'T-Test'), 'Average: ' + mean.toFixed(2) + ' (Limit: ' + L + ')', 'p-value: ' + p.toFixed(4)].forEach(function (s) { var li = document.createElement('li'); li.innerHTML = s; out.appendChild(li); });
        initLabChart(mean, L);
    }

    function renderHistory() {
        var arr = JSON.parse(localStorage.getItem('fs_reviews_v1') || '[]');
        var tb = document.querySelector('#history_table tbody'); if (!tb) return; tb.innerHTML = '';
        // Dashboard Stats Update
if(el('dash_total')) el('dash_total').textContent = arr.length;
var safe = arr.filter(function(r){ return r.verdict === 'Safe'; }).length;
var unsafe = arr.filter(function(r){ return r.verdict === 'Unsafe'; }).length;
var avgScore = arr.length ? Math.round(arr.reduce(function(s,r){ return s + r.score; }, 0) / arr.length) : 0;
if(el('dash_safe')) el('dash_safe').textContent = safe;
if(el('dash_unsafe')) el('dash_unsafe').textContent = unsafe;
if(el('dash_avg')) el('dash_avg').textContent = avgScore + '%';
        arr.forEach(function (r) { var tr = document.createElement('tr'); tr.innerHTML = '<td>' + escapeHtml(r.ts) + '</td><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.cat) + '</td><td>' + escapeHtml(r.verdict) + '</td><td>' + r.score + '</td><td>' + escapeHtml(r.origin) + '</td><td>' + escapeHtml((r.notes || '').slice(0, 80)) + '</td>'; tb.appendChild(tr); });
    }

    function exportHistoryCSV() { var a = JSON.parse(localStorage.getItem('fs_reviews_v1') || '[]'); if (!a.length) { alert('No history'); return; } var csv = 'Date,Product,Category,Verdict,Score\n' + a.map(function (r) { return '"' + r.ts + '","' + r.name + '","' + r.cat + '","' + r.verdict + '",' + r.score; }).join('\n'); var b = new Blob([csv], { type: 'text/csv' }); var link = document.createElement('a'); link.href = URL.createObjectURL(b); link.download = 'reviews.csv'; document.body.appendChild(link); link.click(); link.remove(); }
   function clearHistory() { 
    if (confirm('Clear all history?')) { 
        localStorage.removeItem('fs_reviews_v1'); 
        renderHistory(); 
        // Dashboard reset
        if(el('dash_total')) el('dash_total').textContent = '0';
        if(el('dash_safe')) el('dash_safe').textContent = '0';
        if(el('dash_unsafe')) el('dash_unsafe').textContent = '0';
        if(el('dash_avg')) el('dash_avg').textContent = '0%';
    } 
}



    // ============================================================
    //  ML SECTION - DETAILED CALCULATIONS VISIBLE
    // ============================================================

    var mlChart = null;

    function showMLResult(text, isHeading) {
        var mlOutput = el('ml-output');
        var mlResultsDiv = el('ml-results');
        if (!mlOutput || !mlResultsDiv) return;
        mlResultsDiv.style.display = 'block';
        if (isHeading) {
            mlOutput.innerHTML += '<strong style="color:#15803d; font-size:1.1rem; display:block; margin:15px 0 8px;">' + text + '</strong>';
        } else {
            mlOutput.innerHTML += '<span style="line-height:1.8;">' + text + '</span><br>';
        }
        mlOutput.scrollTop = mlOutput.scrollHeight;
    }

    function clearMLResults() {
        var mlOutput = el('ml-output');
        var mlResultsDiv = el('ml-results');
        if (mlOutput) mlOutput.innerHTML = '';
        if (mlResultsDiv) mlResultsDiv.style.display = 'none';
        if (mlChart) { mlChart.destroy(); mlChart = null; }
    }

    function getDemoDataset() {
        return [
            { pH: 6.8, moisture: 12, temperature: 25, safe: 1 },
            { pH: 7.2, moisture: 14, temperature: 30, safe: 1 },
            { pH: 5.5, moisture: 20, temperature: 40, safe: 0 },
            { pH: 8.0, moisture: 8, temperature: 20, safe: 0 },
            { pH: 6.5, moisture: 15, temperature: 35, safe: 1 },
            { pH: 5.8, moisture: 21, temperature: 42, safe: 0 },
            { pH: 7.0, moisture: 11, temperature: 24, safe: 1 },
            { pH: 6.1, moisture: 18, temperature: 38, safe: 0 },
            { pH: 6.9, moisture: 13, temperature: 28, safe: 1 },
            { pH: 7.5, moisture: 10, temperature: 22, safe: 1 }
        ];
    }

    function normalizeFeatures(data) {
        var keys = ['pH', 'moisture', 'temperature'];
        var means = {}, stds = {};
        keys.forEach(function (key) {
            var vals = data.map(function (d) { return d[key]; });
            var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
            var std = Math.sqrt(vals.reduce(function (a, x) { return a + (x - mean) * (x - mean); }, 0) / vals.length) || 1;
            means[key] = mean;
            stds[key] = std;
        });
        return data.map(function (d) {
            return {
                pH: (d.pH - means.pH) / stds.pH,
                moisture: (d.moisture - means.moisture) / stds.moisture,
                temperature: (d.temperature - means.temperature) / stds.temperature,
                safe: d.safe
            };
        });
    }

    // ===== EDA - Full Calculation Visible =====
    async function runEDA() {
        if (typeof tf === 'undefined') { alert('TensorFlow.js not loaded'); return; }
        clearMLResults();
        showMLResult("📊 EXPLORATORY DATA ANALYSIS (EDA)", true);
        showMLResult("Analyzing 10 food samples for patterns...\n");

        var data = getDemoDataset();
        var safeCount = data.filter(function (d) { return d.safe === 1; }).length;
        var unsafeCount = data.filter(function (d) { return d.safe === 0; }).length;

        showMLResult("━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📋 DATASET OVERVIEW:", true);
        showMLResult("Total samples: " + data.length);
        showMLResult("Safe (label=1): " + safeCount + " samples (" + (safeCount / data.length * 100).toFixed(0) + "%)");
        showMLResult("Unsafe (label=0): " + unsafeCount + " samples (" + (unsafeCount / data.length * 100).toFixed(0) + "%)");

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📈 FEATURE STATISTICS:", true);

        ['pH', 'moisture', 'temperature'].forEach(function (key) {
            var vals = data.map(function (d) { return d[key]; });
            var mean = (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(2);
            var min = Math.min.apply(null, vals).toFixed(1);
            var max = Math.max.apply(null, vals).toFixed(1);
            var variance = vals.reduce(function (a, x) { return a + Math.pow(x - mean, 2); }, 0) / vals.length;
            var std = Math.sqrt(variance).toFixed(2);

            showMLResult("\n" + key.toUpperCase() + ":");
            showMLResult("  Mean: " + mean + " | Std Dev: " + std);
            showMLResult("  Min: " + min + " | Max: " + max);

            // Safe vs Unsafe comparison
            var safeVals = data.filter(function (d) { return d.safe === 1; }).map(function (d) { return d[key]; });
            var unsafeVals = data.filter(function (d) { return d.safe === 0; }).map(function (d) { return d[key]; });
            var safeMean = (safeVals.reduce(function (a, b) { return a + b; }, 0) / safeVals.length).toFixed(2);
            var unsafeMean = (unsafeVals.reduce(function (a, b) { return a + b; }, 0) / unsafeVals.length).toFixed(2);
            showMLResult("  Safe avg: " + safeMean + " | Unsafe avg: " + unsafeMean);
        });

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n🔍 KEY OBSERVATIONS:", true);
        showMLResult("• High moisture (>18%) strongly correlates with UNSAFE food");
        showMLResult("• High temperature (>35°C) increases risk significantly");
        showMLResult("• pH near neutral (6.5-7.5) is more common in SAFE food");
        showMLResult("• Extreme pH (very low or very high) indicates processing/risk");

        showMLResult("\n📊 Generating scatter plot (pH vs Moisture)...", false);

        // Chart
        var ctx = el('mlChart');
        if (!ctx) return;
        ctx = ctx.getContext('2d');
        if (mlChart) mlChart.destroy();

        mlChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Safe Foods (label=1)',
                        data: data.filter(function (d) { return d.safe === 1; }).map(function (d) { return { x: d.pH, y: d.moisture }; }),
                        backgroundColor: '#16a34a',
                        pointRadius: 10,
                        pointHoverRadius: 12
                    },
                    {
                        label: 'Unsafe Foods (label=0)',
                        data: data.filter(function (d) { return d.safe === 0; }).map(function (d) { return { x: d.pH, y: d.moisture }; }),
                        backgroundColor: '#dc2626',
                        pointRadius: 10,
                        pointHoverRadius: 12
                    }
                ]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'pH Value', font: { size: 13 } }, min: 4, max: 9 },
                    y: { title: { display: true, text: 'Moisture (%)', font: { size: 13 } }, min: 0, max: 25 }
                },
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } },
                    title: {
                        display: true,
                        text: 'EDA: pH vs Moisture (Safe vs Unsafe)',
                        font: { size: 14, weight: 'bold' }
                    }
                }
            }
        });

        showMLResult("✅ EDA Complete! Chart generated above.", false);
    }

    // ===== LINEAR REGRESSION - Full Calculation =====
    async function runLinearRegression() {
        if (typeof tf === 'undefined') { alert('TensorFlow.js not loaded'); return; }
        clearMLResults();
        showMLResult("📈 LINEAR REGRESSION", true);
        showMLResult("Goal: Predict safety SCORE (0-100) from pH, Moisture, Temperature\n");

        var data = getDemoDataset();
        showMLResult("━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📝 DATA PREPARATION:", true);
        showMLResult("Raw samples: " + data.length);

        // Show normalization
        showMLResult("\nApplying Z-score normalization...");
        var normalizedData = normalizeFeatures(data);
        showMLResult("Formula: z = (x - mean) / std");

        ['pH', 'moisture', 'temperature'].forEach(function (key) {
            var rawVals = data.map(function (d) { return d[key]; });
            var normVals = normalizedData.map(function (d) { return d[key]; });
            var rawMean = (rawVals.reduce(function (a, b) { return a + b; }, 0) / rawVals.length).toFixed(2);
            var rawStd = Math.sqrt(rawVals.reduce(function (a, x) { return a + Math.pow(x - rawMean, 2); }, 0) / rawVals.length).toFixed(2);
            showMLResult("  " + key + ": mean=" + rawMean + ", std=" + rawStd);
        });

        showMLResult("\nNormalized data (first 3 rows):");
        normalizedData.slice(0, 3).forEach(function (d, i) {
            showMLResult("  [" + i + "] pH=" + d.pH.toFixed(3) + ", Moisture=" + d.moisture.toFixed(3) + ", Temp=" + d.temperature.toFixed(3) + " → Label=" + d.safe);
        });

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n🧠 MODEL TRAINING:", true);
        showMLResult("Architecture: 1 Dense layer (linear activation)");
        showMLResult("Input shape: [3] (pH, Moisture, Temp)");
        showMLResult("Output: 1 neuron (safety score)");
        showMLResult("Loss: Mean Squared Error (MSE)");
        showMLResult("Optimizer: Adam (lr=0.1)");
        showMLResult("Epochs: 200");

        var xs = tf.tensor2d(normalizedData.map(function (d) { return [d.pH, d.moisture, d.temperature]; }));
        var ys = tf.tensor2d(normalizedData.map(function (d) { return [d.safe * 100]; }));

        var model = tf.sequential();
        model.add(tf.layers.dense({ units: 1, inputShape: [3], activation: 'linear' }));
        model.compile({ loss: 'meanSquaredError', optimizer: tf.train.adam(0.1) });

        showMLResult("\nTraining started...", false);
        var finalLoss = 0;
        await model.fit(xs, ys, {
            epochs: 200,
            shuffle: true,
            callbacks: {
                onEpochEnd: function (epoch, logs) {
                    finalLoss = logs.loss;
                    if (epoch === 0) showMLResult("  Epoch 1   → Loss: " + logs.loss.toFixed(4));
                    if (epoch === 49) showMLResult("  Epoch 50  → Loss: " + logs.loss.toFixed(4));
                    if (epoch === 99) showMLResult("  Epoch 100 → Loss: " + logs.loss.toFixed(4));
                    if (epoch === 149) showMLResult("  Epoch 150 → Loss: " + logs.loss.toFixed(4));
                    if (epoch === 199) showMLResult("  Epoch 200 → Loss: " + logs.loss.toFixed(4));
                }
            }
        });

        showMLResult("\n✅ Training complete! Final Loss: " + finalLoss.toFixed(4));

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📐 LEARNED WEIGHTS (Coefficients):", true);

        var weights = model.layers[0].getWeights()[0].arraySync().flat();
        var bias = model.layers[0].getWeights()[1].arraySync()[0];

        showMLResult("Equation: Score = (w1×pH) + (w2×Moisture) + (w3×Temp) + bias");
        showMLResult("");
        showMLResult("  w1 (pH):         " + weights[0].toFixed(4) + "  → " + (weights[0] > 0 ? "POSITIVE effect on safety" : "NEGATIVE effect on safety"));
        showMLResult("  w2 (Moisture):   " + weights[1].toFixed(4) + "  → " + (weights[1] > 0 ? "POSITIVE effect on safety" : "NEGATIVE effect on safety"));
        showMLResult("  w3 (Temp):       " + weights[2].toFixed(4) + "  → " + (weights[2] > 0 ? "POSITIVE effect on safety" : "NEGATIVE effect on safety"));
        showMLResult("  Bias:            " + bias.toFixed(4));

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n🔍 INTERPRETATION:", true);
        showMLResult("• Higher weight = more influence on safety score");
        showMLResult("• Negative weight means that feature REDUCES safety");
        showMLResult("• Usually: High Moisture & High Temp → NEGATIVE (unsafe)");
        showMLResult("• Usually: Normal pH → POSITIVE or neutral effect");

        showMLResult("\n⚠️ Note: Linear Regression gives continuous score, not classification.", false);

        xs.dispose();
        ys.dispose();
        model.dispose();
    }

    // ===== LOGISTIC REGRESSION - Full Calculation =====
    async function runLogisticBase(title, l2, l1) {
        if (typeof tf === 'undefined') { alert('TensorFlow.js not loaded'); return; }
        clearMLResults();

        showMLResult("🧠 " + title, true);
        if (l2) showMLResult("Regularization: L2 (Ridge) — lambda=0.01");
        if (l1) showMLResult("Regularization: L1 (Lasso) — lambda=0.01");
        if (!l2 && !l1) showMLResult("Regularization: None (plain logistic)");
        showMLResult("Goal: Classify food as SAFE (1) or UNSAFE (0)\n");

        var data = getDemoDataset();

        showMLResult("━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📝 PREPARATION:", true);
        var normalizedData = normalizeFeatures(data);
        showMLResult("Samples: " + normalizedData.length + " | Features: 3 (normalized)");
        showMLResult("Labels: " + normalizedData.filter(function (d) { return d.safe === 1; }).length + " safe, " + normalizedData.filter(function (d) { return d.safe === 0; }).length + " unsafe");

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n🧠 MODEL:", true);
        showMLResult("Architecture: Dense(1, sigmoid)");
        showMLResult("Sigmoid: σ(z) = 1 / (1 + e^(-z))");
        showMLResult("Output: Probability (0 to 1)");
        showMLResult("Threshold: p > 0.5 → Safe, p ≤ 0.5 → Unsafe");
        showMLResult("Loss: Binary Cross-Entropy");
        showMLResult("Optimizer: Adam (lr=0.08)");
        showMLResult("Epochs: 150\n");

        var xs = tf.tensor2d(normalizedData.map(function (d) { return [d.pH, d.moisture, d.temperature]; }));
        var ys = tf.tensor2d(normalizedData.map(function (d) { return [d.safe]; }));

        var reg = l2 ? tf.regularizers.l2({ l2: l2 }) : (l1 ? tf.regularizers.l1({ l1: l1 }) : null);
        var model = tf.sequential();
        model.add(tf.layers.dense({
            units: 1,
            inputShape: [3],
            activation: 'sigmoid',
            kernelRegularizer: reg
        }));
        model.compile({
            loss: 'binaryCrossentropy',
            optimizer: tf.train.adam(0.08),
            metrics: ['accuracy']
        });

        showMLResult("Training progress:", false);
        var finalAcc = 0, finalLoss = 0;
        await model.fit(xs, ys, {
            epochs: 150,
            shuffle: true,
            callbacks: {
                onEpochEnd: function (epoch, logs) {
                    finalAcc = logs.acc;
                    finalLoss = logs.loss;
                    if (epoch % 30 === 0 || epoch === 149) {
                        var bar = '';
                        var filled = Math.round(logs.acc * 20);
                        for (var b = 0; b < filled; b++) bar += '█';
                        for (var b = filled; b < 20; b++) bar += '░';
                        showMLResult("  Epoch " + String(epoch + 1).padStart(3) + " │ " + bar + " │ Acc: " + (logs.acc * 100).toFixed(1) + "% │ Loss: " + logs.loss.toFixed(4));
                    }
                }
            }
        });

        showMLResult("\n✅ Training complete!");

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📊 PREDICTION RESULTS:", true);

        var preds = model.predict(xs).arraySync().flat();
        var predLabels = preds.map(function (p) { return p > 0.5 ? 1 : 0; });

        showMLResult("\nSample-by-sample predictions:");
        showMLResult("  # │  Actual  │  Probability  │  Predicted  │  Correct?");
        showMLResult("  ──┼──────────┼───────────────┼─────────────┼──────────");

        var correct = 0;
        for (var i = 0; i < normalizedData.length; i++) {
            var isCorrect = predLabels[i] === normalizedData[i].safe;
            if (isCorrect) correct++;
            var mark = isCorrect ? '✅' : '❌';
            showMLResult("  " + String(i + 1).padStart(2) + " │    " + normalizedData[i].safe + "     │    " + preds[i].toFixed(4) + "    │      " + predLabels[i] + "      │  " + mark);
        }

        var acc = (correct / normalizedData.length) * 100;
        var predictedSafe = predLabels.filter(function (p) { return p === 1; }).length;
        var predictedUnsafe = predLabels.filter(function (p) { return p === 0; }).length;

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n🏆 FINAL RESULTS:", true);
        showMLResult("Accuracy: " + acc.toFixed(1) + "% (" + correct + "/" + normalizedData.length + " correct)");
        showMLResult("Final Loss: " + finalLoss.toFixed(4));
        showMLResult("Predicted Safe: " + predictedSafe + " | Predicted Unsafe: " + predictedUnsafe);

        var verdict = predictedSafe >= predictedUnsafe ? "✅ Overall: SAFE tendency" : "❌ Overall: UNSAFE tendency";
        showMLResult("\n" + verdict, true);

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📌 FEATURE IMPORTANCE:", true);

        var weights = model.layers[0].getWeights()[0].arraySync().flat();
        showMLResult("  pH:          " + weights[0].toFixed(4) + "  → " + (weights[0] > 0 ? "Higher pH → More Safe" : "Lower pH → More Safe"));
        showMLResult("  Moisture:    " + weights[1].toFixed(4) + "  → " + (weights[1] > 0 ? "Higher Moisture → More Safe" : "Higher Moisture → More Risk"));
        showMLResult("  Temperature: " + weights[2].toFixed(4) + "  → " + (weights[2] > 0 ? "Higher Temp → More Safe" : "Higher Temp → More Risk"));

        if (l2) showMLResult("\n💡 L2 reduced weight magnitudes → less overfitting");
        if (l1) showMLResult("\n💡 L1 can push weak weights to ~0 → feature selection");

        xs.dispose();
        ys.dispose();
        model.dispose();
    }

    async function runLogistic() { await runLogisticBase("LOGISTIC REGRESSION"); }
    async function runRidge() { await runLogisticBase("RIDGE REGRESSION (L2)", 0.01); }
    async function runLasso() { await runLogisticBase("LASSO REGRESSION (L1)", 0, 0.01); }

    // ===== HISTOGRAMS  =====
    async function showHistograms() {
        clearMLResults();
        showMLResult("📊 HISTOGRAMS — Feature Distribution", true);
        showMLResult("Comparing Safe vs Unsafe food averages\n");

        var data = getDemoDataset();
        var safe = data.filter(function (d) { return d.safe === 1; });
        var unsafe = data.filter(function (d) { return d.safe === 0; });

        showMLResult("━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n📋 CALCULATIONS:", true);

        ['pH', 'moisture', 'temperature'].forEach(function (key) {
            var safeVals = safe.map(function (d) { return d[key]; });
            var unsafeVals = unsafe.map(function (d) { return d[key]; });
            var safeAvg = (safeVals.reduce(function (a, b) { return a + b; }, 0) / safeVals.length).toFixed(2);
            var unsafeAvg = (unsafeVals.reduce(function (a, b) { return a + b; }, 0) / unsafeVals.length).toFixed(2);
            var diff = (safeAvg - unsafeAvg).toFixed(2);
            showMLResult("\n" + key.toUpperCase() + ":");
            showMLResult("  Safe avg:   " + safeAvg + " (n=" + safeVals.length + ")");
            showMLResult("  Unsafe avg: " + unsafeAvg + " (n=" + unsafeVals.length + ")");
            showMLResult("  Difference: " + diff + (Math.abs(diff) > 3 ? "  ⚠️ SIGNIFICANT GAP" : "  → small gap"));
        });

        showMLResult("\n━━━━━━━━━━━━━━━━━━━━━━━━━━", false);
        showMLResult("\n🔍 INSIGHTS:", true);
        showMLResult("• Moisture has the LARGEST gap between safe/unsafe → best predictor");
        showMLResult("• Temperature also shows clear separation");
        showMLResult("• pH has moderate separation");

        showMLResult("\n📊 Chart generated below:", false);

        // Chart
        var ctx = el('mlChart');
        if (!ctx) return;
        ctx = ctx.getContext('2d');
        if (mlChart) mlChart.destroy();

        mlChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['pH', 'Moisture (%)', 'Temperature (°C)'],
                datasets: [
                    {
                        label: 'Safe Foods (n=' + safe.length + ')',
                        data: [
                            safe.reduce(function (a, b) { return a + b.pH; }, 0) / safe.length,
                            safe.reduce(function (a, b) { return a + b.moisture; }, 0) / safe.length,
                            safe.reduce(function (a, b) { return a + b.temperature; }, 0) / safe.length
                        ],
                        backgroundColor: '#16a34a',
                        borderColor: '#15803d',
                        borderWidth: 2
                    },
                    {
                        label: 'Unsafe Foods (n=' + unsafe.length + ')',
                        data: [
                            unsafe.reduce(function (a, b) { return a + b.pH; }, 0) / unsafe.length,
                            unsafe.reduce(function (a, b) { return a + b.moisture; }, 0) / unsafe.length,
                            unsafe.reduce(function (a, b) { return a + b.temperature; }, 0) / unsafe.length
                        ],
                        backgroundColor: '#dc2626',
                        borderColor: '#b91c1c',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 13 } } },
                    title: {
                        display: true,
                        text: 'Average Feature Values: Safe vs Unsafe',
                        font: { size: 15, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Average Value', font: { size: 12 } }
                    }
                }
            }
        });

        showMLResult("✅ Histograms complete!", false);
    }


    // ============================================================
    //  IMAGE LABEL 
    // ============================================================

    function realImageAnalysis(imageDataUrl) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                var total = pixels.length / 4;

                var red = 0, green = 0, blue = 0, yellow = 0, orange = 0, brown = 0, cream = 0, white = 0, dark = 0;
                var satSum = 0;

                for (var i = 0; i < pixels.length; i += 4) {
                    var r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                    var maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
                    var sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
                    satSum += sat;
                    if (r > 240 && g > 240 && b > 240) white++;
                    if ((r + g + b) / 3 < 40) dark++;
                    if (sat > 0.15) {
                        if (r > 150 && r > g * 1.5 && r > b * 1.5) red++;
                        if (g > 100 && g > r * 1.3 && g > b * 1.3) green++;
                        if (b > 120 && b > r * 1.3 && b > g * 1.3) blue++;
                        if (r > 150 && g > 150 && b < 100) yellow++;
                        if (r > 180 && g > 80 && g < 180 && b < 80) orange++;
                        if (r > 80 && r < 180 && g > 30 && g < 120 && b < 80) brown++;
                        if (r > 200 && g > 180 && b > 140 && b < 200) cream++;
                    }
                }

                var p = { red: red / total * 100, green: green / total * 100, blue: blue / total * 100, yellow: yellow / total * 100, orange: orange / total * 100, brown: brown / total * 100, cream: cream / total * 100, white: white / total * 100, dark: dark / total * 100 };

                var scores = {};
                scores['Fresh Produce'] = p.green * 3 + p.yellow * 0.5;
                scores['Dairy'] = p.cream * 4 + p.white * 2 + p.blue * 1.5;
                scores['Meat & Poultry'] = p.red * 4 + p.brown * 2 + p.dark;
                scores['Packaged Snack'] = p.yellow * 3.5 + p.orange * 3 + p.red;
                scores['Beverage'] = p.blue * 3 + p.orange * 2 + p.white * 1.5;
                scores['Bakery'] = p.brown * 4 + p.cream * 2 + p.yellow;
                scores['Frozen Food'] = p.blue * 4 + p.white * 3;
                scores['Baby Food'] = p.cream * 3 + p.white * 2;
                scores['Seafood'] = p.blue * 3 + p.red * 2 + p.brown;
                scores['Street Food'] = p.orange * 3 + p.yellow * 2 + p.red * 1.5;

                var sorted = Object.entries(scores).sort(function (a, b) { return b[1] - a[1]; });
                var topCat = sorted[0][0], secondCat = sorted[1][0];
                var gap = sorted[0][1] - sorted[1][1];
                var confidence = Math.min(Math.max(Math.round((gap / (sorted[0][1] + sorted[1][1])) * 100 + 25), 30), 70);

                var vegScore = p.green + p.yellow + p.cream;
                var nonVegScore = p.red + p.brown + p.dark;
                var veg = Math.abs(vegScore - nonVegScore) < 3 ? "Unclear ⚠️" : (vegScore > nonVegScore ? "Likely Veg 🟢" : "Likely Non-Veg 🔴");

                var colorTotal = p.red + p.green + p.blue + p.yellow + p.orange + p.brown + p.cream;
                var isFood = colorTotal > 30;

                var checks = [];
                if (colorTotal > 30) checks.push("✓ Food colors (" + colorTotal.toFixed(0) + "%)"); else checks.push("✗ Low food colors");
                if (dark > 5 || white > 2) checks.push("✓ Text detected"); else checks.push("⚠ Little text");
                if (canvas.width > 150) checks.push("✓ Resolution " + canvas.width + "x" + canvas.height); else checks.push("✗ Low resolution");

                resolve({ isFood: isFood, topCat: topCat, secondCat: secondCat, confidence: confidence, veg: veg, checks: checks });
            };
            img.onerror = function () { resolve({ isFood: false, topCat: "Unknown", secondCat: "Unknown", confidence: 0, veg: "Unknown", checks: ["✗ Invalid image"] }); };
            img.src = imageDataUrl;
        });
    }


    // ========== IMAGE UPLOAD - EK ALERT, NO HTML ==========
    var labelInput = el('labelImage');
    var previewDiv = el('imagePreview');

    if (labelInput && previewDiv) {
        labelInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { alert("❌ Upload image file (JPG/PNG)"); return; }

            var reader = new FileReader();
            reader.onload = function (ev) {
                var imageDataUrl = ev.target.result;

                
                previewDiv.innerHTML = '<img src="' + imageDataUrl + '" style="max-width:100%; max-height:250px; border-radius:8px; border:2px solid #e5e7eb;">';

                                realImageAnalysis(imageDataUrl).then(function (r) {
                    var imgRes = el('imageResult');

                    if (!r.isFood) {
                    
                        if(imgRes) {
                            imgRes.style.display = 'block';
                            imgRes.style.background = '#fef2f2';
                            imgRes.style.borderColor = '#dc2626';
                            imgRes.innerHTML = '<strong style="color:#dc2626;">❌ Not a Food Label</strong><br><small>' + r.checks.join(' | ') + '</small><br><small>💡 Upload front of food package with clear label</small>';
                        }
                        previewDiv.innerHTML = '<div style="padding:20px; background:#fef2f2; border:2px solid #dc2626; border-radius:8px; color:#b91c1c; text-align:center;">❌ Not a food label. Try again.</div>';
                        return;
                    }

                
                    if(imgRes) {
                        imgRes.style.display = 'block';
                        imgRes.style.background = '#f0fdf4';
                        imgRes.style.borderColor = '#16a34a';
                        imgRes.innerHTML = '<strong style="color:#16a34a;">✅ Food Label Detected</strong><br>🏷️ Category: <strong>'+r.topCat+'</strong> (2nd: '+r.secondCat+')<br>📊 Confidence: '+r.confidence+'% | 🌿 '+r.veg+'<br>🔍 ' + r.checks.join(' | ') + '<br><br><em style="color:#6b7280;">✏️ Form auto-filled below! (Enter Product Name manually)</em>';
                    }

                
                    if (el('p_cat')) el('p_cat').value = r.topCat;
                    var range = tempRanges[r.topCat];
                    if (range) { if (el('t_min')) el('t_min').value = range[0]; if (el('t_max')) el('t_max').value = range[1]; }
                    if (el('p_origin')) el('p_origin').value = 'India';
                    if (el('fssai')) { var f = ''; for (var i = 0; i < 14; i++) f += Math.floor(Math.random() * 10); el('fssai').value = f; }
                    if (el('p_exp')) { var d = new Date(); d.setMonth(d.getMonth() + 6); el('p_exp').value = d.toISOString().slice(0, 10); }
                    if (el('p_name')) { el('p_name').value = ''; el('p_name').focus(); }

                });
            };
            reader.readAsDataURL(file);
        });
    }
// ============================================================
//  BARCODE SCANNER - Camera + Upload + Manual + API
// ============================================================

var cameraRunning = false;

// --- Open Food Facts API Fetch ---
function fetchProductFromAPI(barcode) {
    var resultDiv = el('barcodeResult');
    if (!resultDiv) return;
    
    resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div style="padding:15px; text-align:center;"><span class="loader"></span> Searching barcode <strong>' + barcode + '</strong> in Open Food Facts database...</div>';
    
    // Open Food Facts API - FREE, no key needed
    var url = 'https://world.openfoodfacts.org/api/v0/product/' + barcode + '.json';
    
    fetch(url)
        .then(function (response) {
            if (!response.ok) throw new Error('API Error: ' + response.status);
            return response.json();
        })
        .then(function (data) {
            console.log("📦 API Response:", data);
            
            if (data.status === 0 || !data.product) {
                resultDiv.innerHTML = '<div style="padding:15px; background:#fef2f2; border:2px solid #dc2626; border-radius:8px; color:#b91c1c; text-align:center;"><strong>❌ Product Not Found</strong><br><small>Barcode ' + barcode + ' not in database. Try another or enter manually.</small></div>';
                return;
            }
            
            var p = data.product;
            var name = p.product_name || p.product_name_en || 'Unknown Product';
            var brand = p.brands || 'Unknown Brand';
            var category = p.categories || '';
            var ingredients = p.ingredients_text || p.ingredients_text_en || '';
            var allergens = p.allergens || '';
            var additives = p.additives || '';
            var image = p.image_front_small_url || p.image_front_url || '';
            var countries = p.countries || '';
            
            // Extract nutrition
            var nutriments = p.nutriments || {};
            var kcal = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || '';
            var sugar = nutriments.sugars_100g || '';
            var sodium = nutriments.sodium_100g || '';
            var sat = nutriments['saturated-fat_100g'] || nutriments['saturated-fat'] || '';
            var trans = nutriments['trans-fat_100g'] || '';
            var fat = nutriments.fat_100g || '';
            var protein = nutriments.proteins_100g || '';
            var carbs = nutriments.carbohydrates_100g || '';
            
            // Determine category for our form
            var ourCategory = 'Packaged Snack'; // default
            var catLower = (category + ' ' + name + ' ' + ingredients).toLowerCase();
            
            if (catLower.includes('dairy') || catLower.includes('milk') || catLower.includes('cheese') || catLower.includes('yogurt') || catLower.includes('butter') || catLower.includes('cream') || catLower.includes('paneer') || catLower.includes('ghee')) {
                ourCategory = 'Dairy';
            } else if (catLower.includes('meat') || catLower.includes('chicken') || catLower.includes('poultry') || catLower.includes('mutton') || catLower.includes('beef') || catLower.includes('pork')) {
                ourCategory = 'Meat & Poultry';
            } else if (catLower.includes('fish') || catLower.includes('seafood') || catLower.includes('shrimp') || catLower.includes('salmon') || catLower.includes('tuna')) {
                ourCategory = 'Seafood';
            } else if (catLower.includes('beverage') || catLower.includes('drink') || catLower.includes('juice') || catLower.includes('tea') || catLower.includes('coffee') || catLower.includes('water') || catLower.includes('cola') || catLower.includes('soda')) {
                ourCategory = 'Beverage';
            } else if (catLower.includes('bread') || catLower.includes('bakery') || catLower.includes('cake') || catLower.includes('biscuit') || catLower.includes('cookie') || catLower.includes('pastry')) {
                ourCategory = 'Bakery';
            } else if (catLower.includes('frozen') || catLower.includes('ice cream') || catLower.includes('pizza')) {
                ourCategory = 'Frozen Food';
            } else if (catLower.includes('baby') || catLower.includes('infant')) {
                ourCategory = 'Baby Food';
            } else if (catLower.includes('snack') || catLower.includes('chips') || catLower.includes('namkeen') || catLower.includes('noodle') || catLower.includes('instant')) {
                ourCategory = 'Packaged Snack';
            } else if (catLower.includes('fruit') || catLower.includes('vegetable') || catLower.includes('organic') || catLower.includes('fresh')) {
                ourCategory = 'Fresh Produce';
            }
            
            // Determine origin
            var origin = 'India';
            if (countries) {
                var cLower = countries.toLowerCase();
                if (cLower.includes('india')) origin = 'India';
                else if (cLower.includes('france') || cLower.includes('germany') || cLower.includes('usa') || cLower.includes('uk') || cLower.includes('japan') || cLower.includes('china')) {
                    origin = 'Imported';
                } else {
                    origin = 'Imported';
                }
            }
            
            // FSSAI - check if available
            var fssai = '';
            if (p.allergens_tags && p.allergens_tags.length) {
                // Open Food Facts doesn't have FSSAI, generate mock
                fssai = '';
            }
            
            // Expiry - not usually in API, set 6 months ahead
            var expDate = new Date();
            if (p.expiration_date) {
                var parts = p.expiration_date.split('-');
                if (parts.length === 3) expDate = new Date(parts[0], parts[1] - 1, parts[2]);
                else expDate.setMonth(expDate.getMonth() + 6);
            } else {
                expDate.setMonth(expDate.getMonth() + 6);
            }
            
            
            // ===== BUILD RESULT DISPLAY =====
            var html = '';
            html += '<div style="padding:20px; background:linear-gradient(135deg, #f0fdf4, #dcfce7); border:2px solid #16a34a; border-radius:12px;">';
            html += '<div style="display:flex; gap:15px; flex-wrap:wrap; align-items:flex-start;">';
            
            // Product image
            if (image) {
                html += '<img src="' + image + '" style="width:120px; height:120px; object-fit:contain; border-radius:8px; border:2px solid #e5e7eb; background:white;" onerror="this.style.display=\'none\'">';
            }
            
            // Product info
            html += '<div style="flex:1; min-width:250px;">';
            html += '<div style="font-size:1.3rem; font-weight:700; color:#15803d;">' + escapeHtml(name) + '</div>';
            html += '<div style="font-size:0.9rem; color:#374151; margin-top:4px;">Brand: ' + escapeHtml(brand) + '</div>';
            html += '<div style="font-size:0.85rem; color:#6b7280; margin-top:2px;">Category: ' + escapeHtml(ourCategory) + '</div>';
            html += '<div style="font-size:0.85rem; color:#6b7280;">Barcode: ' + barcode + '</div>';
            html += '</div>';
            html += '</div>';
            
            // Nutrition table
            html += '<div style="margin-top:15px; background:white; border-radius:8px; padding:12px; border:1px solid #e5e7eb;">';
            html += '<div style="font-weight:600; color:#374151; margin-bottom:8px;">📊 Nutrition (per 100g):</div>';
            html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:6px; font-size:0.85rem;">';
            
            if (kcal) html += '<div>🔥 Energy: <strong>' + kcal + ' kcal</strong></div>';
            if (fat) html += '<div>🧈 Fat: <strong>' + fat + ' g</strong></div>';
            if (sat) html += '<div>⛔ Sat Fat: <strong>' + sat + ' g</strong></div>';
            if (trans) html += '<div>⚠️ Trans Fat: <strong>' + trans + ' g</strong></div>';
            if (carbs) html += '<div>🍞 Carbs: <strong>' + carbs + ' g</strong></div>';
            if (sugar) html += '<div>🍬 Sugar: <strong>' + sugar + ' g</strong></div>';
            if (protein) html += '<div>💪 Protein: <strong>' + protein + ' g</strong></div>';
            if (sodium) html += '<div>🧂 Sodium: <strong>' + sodium + ' g</strong></div>';
            
            html += '</div></div>';
            
            // Ingredients & Allergens
            if (ingredients) {
                html += '<div style="margin-top:10px; background:white; border-radius:8px; padding:12px; border:1px solid #e5e7eb;">';
                html += '<div style="font-weight:600; color:#374151; margin-bottom:4px;">📝 Ingredients:</div>';
                html += '<div style="font-size:0.8rem; color:#4b5563; max-height:60px; overflow-y:auto;">' + escapeHtml(ingredients) + '</div>';
                html += '</div>';
            }
            
            if (allergens) {
                html += '<div style="margin-top:8px; padding:8px 12px; background:#fef2f2; border-radius:6px; font-size:0.85rem; color:#b91c1c;">';
                html += '⚠️ Allergens: ' + escapeHtml(allergens.replace(/,/g, ', '));
                html += '</div>';
            }
            
            if (additives) {
                html += '<div style="margin-top:6px; padding:8px 12px; background:#fffbeb; border-radius:6px; font-size:0.85rem; color:#92400e;">';
                html += '🧪 Additives: ' + escapeHtml(additives.replace(/,/g, ', '));
                html += '</div>';
            }
            
            // Auto-fill button
            html += '<div style="margin-top:15px; text-align:center;">';
            html += '<button onclick="autoFillFromBarcode(\'' + escapeHtml(name).replace(/'/g, "\\'") + '\',\'' + ourCategory + '\',\'' + escapeHtml(ingredients).replace(/'/g, "\\'") + '\',\'' + origin + '\',' + (kcal || 0) + ',' + (sugar || 0) + ',' + (sodium ? sodium * 1000 : 0) + ',' + (sat || 0) + ',' + (trans || 0) + ')" class="btn" style="background:#16a34a; color:white; padding:12px 30px; font-size:1rem; border-radius:8px; border:none; cursor:pointer;">';
            html += '<i class="fas fa-magic"></i> Auto-Fill Form with This Data</button>';
            html += '</div>';
            
            // Data source
            html += '<div style="margin-top:10px; text-align:center; font-size:0.72rem; color:#9ca3af;">';
            html += 'Data Source: Open Food Facts (openfoodfacts.org) — Open Database';
            html += '</div>';
            
            html += '</div>';
            
            resultDiv.innerHTML = html;
            
        })
        .catch(function (err) {
            console.error("API Error:", err);
            resultDiv.innerHTML = '<div style="padding:15px; background:#fef2f2; border:2px solid #dc2626; border-radius:8px; color:#b91c1c; text-align:center;"><strong>❌ Error</strong><br><small>' + err.message + '<br>Check internet connection.</small></div>';
        });
}


// --- Auto-fill form from barcode data ---
// This function needs to be global for onclick to work
window.autoFillFromBarcode = function(name, category, ingredients, origin, kcal, sugar, sodium, sat, trans) {
    if (el('p_name')) el('p_name').value = name;
    if (el('p_cat')) el('p_cat').value = category;
    if (el('p_ing')) el('p_ing').value = ingredients;
    if (el('p_origin')) el('p_origin').value = origin;
    
    if (kcal && el('n_kcal')) el('n_kcal').value = Math.round(kcal);
    if (sugar && el('n_sugar')) el('n_sugar').value = parseFloat(sugar).toFixed(1);
    if (sodium && el('n_sodium')) el('n_sodium').value = Math.round(sodium);
    if (sat && el('n_sat')) el('n_sat').value = parseFloat(sat).toFixed(1);
    if (trans && el('n_trans')) el('n_trans').value = parseFloat(trans).toFixed(1);
    
    // Set temperature
    var range = tempRanges[category];
    if (range) {
        if (el('t_min')) el('t_min').value = range[0];
        if (el('t_max')) el('t_max').value = range[1];
    }
    
    // Expiry 6 months ahead
    if (el('p_exp')) {
        var d = new Date();
        d.setMonth(d.getMonth() + 6);
        el('p_exp').value = d.toISOString().slice(0, 10);
    }
    
    // FSSAI - leave empty for user to enter
    if (el('fssai')) el('fssai').value = '';
    
    // Scroll to form top
    if (el('p_name')) el('p_name').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight the name field
    if (el('p_name')) {
        el('p_name').style.borderColor = '#16a34a';
        el('p_name').style.boxShadow = '0 0 0 3px rgba(22,163,74,0.2)';
        setTimeout(function() {
            el('p_name').style.borderColor = '';
            el('p_name').style.boxShadow = '';
        }, 3000);
    }
    
       // Hide barcode result for clean UI
    if (el('barcodeResult')) el('barcodeResult').style.display = 'none';
    
    // Smooth scroll to the Product Name field
    if (el('p_name')) {
        el('p_name').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// --- CAMERA SCANNING ---
function startCameraScan() {
    if (cameraRunning) return;
    
    var container = el('cameraContainer');
    var view = el('cameraView');
    if (!container || !view) return;
    
    container.style.display = 'block';
    
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: view,
            constraints: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        },
        decoder: {
            readers: [
                "ean_reader",       // EAN-13 (most common on food)
                "ean_8_reader",     // EAN-8
                "upc_reader",       // UPC-A
                "upc_e_reader",     // UPC-E
                "code_128_reader",  // Code 128
                "code_39_reader"    // Code 39
            ],
            multiple: false
        },
        locate: true,
        frequency: 10
    }, function(err) {
        if (err) {
            console.error("Camera Error:", err);
            container.style.display = 'none';
            
            // Fallback message
            var resultDiv = el('barcodeResult');
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<div style="padding:15px; background:#fffbeb; border:2px solid #f59e0b; border-radius:8px; color:#92400e; text-align:center;"><strong>📷 Camera not available</strong><br><small>Error: ' + err.message + '</small><br><br><strong>Alternatives:</strong><br>• Upload barcode image<br>• Type barcode number manually</div>';
            }
            return;
        }
        
        cameraRunning = true;
        Quagga.start();
    });
    
    // When barcode detected
    Quagga.onDetected(function(result) {
        if (result.codeResult && result.codeResult.code) {
            var barcode = result.codeResult.code;
            
            // Stop camera
            stopCameraScan();
            
            // Show what we found
            var resultDiv = el('barcodeResult');
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<div style="padding:15px; background:#dbeafe; border-radius:8px; text-align:center;">✅ Barcode Detected: <strong style="font-size:1.2rem; color:#1e40af;">' + barcode + '</strong><br>Format: ' + result.codeResult.format + '</div>';
            }
            
            // Fetch product data
            setTimeout(function() {
                fetchProductFromAPI(barcode);
            }, 500);
        }
    });
}

function stopCameraScan() {
    if (!cameraRunning) return;
    Quagga.stop();
    cameraRunning = false;
    
    var container = el('cameraContainer');
    if (container) container.style.display = 'none';
}


// --- IMAGE FILE BARCODE SCAN ---
function scanBarcodeFromFile(file) {
    if (!file) return;
    
    var resultDiv = el('barcodeResult');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="padding:15px; background:#dbeafe; border-radius:8px; text-align:center;">⏳ Scanning barcode from image...</div>';
    }
    
    var reader = new FileReader();
    reader.onload = function(ev) {
        var imageDataUrl = ev.target.result;
        
        Quagga.decodeSingle({
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader", "code_39_reader"]
            },
            locate: true,
            src: imageDataUrl
        }, function(result) {
            if (result && result.codeResult && result.codeResult.code) {
                var barcode = result.codeResult.code;
                
                if (resultDiv) {
                    resultDiv.innerHTML = '<div style="padding:15px; background:#dbeafe; border-radius:8px; text-align:center;">✅ Barcode Found: <strong style="font-size:1.2rem; color:#1e40af;">' + barcode + '</strong><br>Format: ' + result.codeResult.format + '</div>';
                }
                
                setTimeout(function() {
                    fetchProductFromAPI(barcode);
                }, 500);
            } else {
                if (resultDiv) {
                    resultDiv.innerHTML = '<div style="padding:15px; background:#fef2f2; border:2px solid #dc2626; border-radius:8px; color:#b91c1c; text-align:center;"><strong>❌ No Barcode Found</strong><br><small>Make sure the barcode is clear and centered in the image.</small><br><br>Supported: EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39</div>';
                }
            }
        }, function(err) {
            console.error("Scan Error:", err);
            if (resultDiv) {
                resultDiv.innerHTML = '<div style="padding:15px; background:#fef2f2; border:2px solid #dc2626; border-radius:8px; color:#b91c1c; text-align:center;"><strong>❌ Scan Failed</strong><br><small>' + (err.message || 'Could not read barcode from image') + '</small></div>';
            }
        });
    };
    reader.readAsDataURL(file);
}


// --- BARCODE EVENT LISTENERS ---
if (el('startCameraBtn')) {
    el('startCameraBtn').addEventListener('click', startCameraScan);
}

if (el('stopCameraBtn')) {
    el('stopCameraBtn').addEventListener('click', stopCameraScan);
}

if (el('barcodeFileInput')) {
    el('barcodeFileInput').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) scanBarcodeFromFile(file);
        // Reset so same file can be scanned again
        this.value = '';
    });
}

if (el('lookupBarcodeBtn')) {
    el('lookupBarcodeBtn').addEventListener('click', function() {
        var barcode = el('manualBarcode') ? el('manualBarcode').value.trim() : '';
        if (!barcode) {
            alert("Please enter a barcode number");
            return;
        }
        // Validate - should be 8, 12, or 13 digits
        if (!/^\d{8,14}$/.test(barcode)) {
            alert("Invalid barcode format.\n\nExpected: 8-14 digits (EAN-8, EAN-13, UPC-A)\nYou entered: " + barcode);
            return;
        }
        fetchProductFromAPI(barcode);
    });
}

// Allow Enter key to trigger lookup
if (el('manualBarcode')) {
    el('manualBarcode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (el('lookupBarcodeBtn')) el('lookupBarcodeBtn').click();
        }
    });
}

// Stop camera when page is hidden (battery save)
document.addEventListener('visibilitychange', function() {
    if (document.hidden && cameraRunning) {
        stopCameraScan();
    }
});
// ==========================================
// UPDATED: CSV BATCH ANALYSIS & PROCESSING
// ==========================================

// 1. CSV File Processor (Triggered on file upload)
function processCSV(file) {
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
        var text = e.target.result;
        var rows = text.split('\n').map(function (r) { return r.split(','); });
        
        // Remove empty rows
        rows = rows.filter(function (r) { return r.length > 1 && r[0].trim() !== ''; });

        if (rows.length < 1) {
            if (el('csv-batch-results')) el('csv-batch-results').innerHTML = '<div style="color:red; padding:10px;">CSV file is empty.</div>';
            return;
        }

        // Check if headers exist (assuming 1st row might be headers)
        // We assume index mapping based on your form:
        // 0:Name, 1:Category, 2:Expiry, 3:Ingredients, 4:Origin, 5:TMin, 6:TMax, 7:Sugar, 8:Sodium, 9:Sat, 10:Trans, 11:Kcal, 12:FSSAI
        
        // Skip header row if the first row contains text like "Name" or "Product"
        var startIndex = 0;
        var firstRowStr = rows[0].join(' ').toLowerCase();
        if (firstRowStr.includes('name') || firstRowStr.includes('product')) {
            startIndex = 1;
        }

        var dataRows = rows.slice(startIndex);
        
        // Show Alert
        alert("Loaded: " + dataRows.length + " products. Analyzing...");

        // RUN BATCH ANALYSIS
        showCSVBatchAnalysis(dataRows);
    };
    reader.readAsText(file);
}

// 2. Batch Analysis Logic (Calculates Risk & Generates Report)
// 2. Batch Analysis Logic (Updated with Allergen Names & Download)
// 2. Batch Analysis Logic (Updated with Allergen Names & Download FIX)
// 2. Batch Analysis Logic (Fixed Download Logic)
function showCSVBatchAnalysis(rows) {
    var outDiv = el('csv-batch-results');
    if (!outDiv) return;

    // Initialize Counters
    var total = rows.length;
    var safeCount = 0;
    var unsafeCount = 0;
    var moderateCount = 0;
    var allergenCountTotal = 0;
    var additiveCountTotal = 0;
    var avgRiskScore = 0;

    var processedData = [];
    var html = '';

    // --- ANALYSIS LOOP ---
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        
        // Map CSV columns
        var name = r[0] ? r[0].trim() : 'Unknown Product';
        var cat = r[1] ? r[1].trim() : 'Packaged Snack';
        var exp = r[2] ? r[2].trim() : '';
        var ing = r[3] ? r[3].trim().toLowerCase() : '';
        var origin = r[4] ? r[4].trim() : 'India';
        var tmin = parseFloat(r[5]) || 0;
        var tmax = parseFloat(r[6]) || 0;
        var sugar = parseFloat(r[7]) || 0;
        var sodium = parseFloat(r[8]) || 0;
        var sat = parseFloat(r[9]) || 0;
        var trans = parseFloat(r[10]) || 0;
        var kcal = parseFloat(r[11]) || 0;
        var fssai = r[12] ? r[12].trim() : '';

        // CALCULATE SCORE
        var score = baseRiskByCategory(cat);
        var notes = [];
        var allergensFound = [];

        // Name Check
        if (!validFoodKeywords.some(function (k) { return name.toLowerCase().includes(k); })) { score += 5; }

        // Expiry Check
        if (exp) {
            var d = new Date(exp), now = new Date(), days = Math.floor((d - now) / (1000 * 3600 * 24));
            if (days < 0) { score += 40; } else if (days <= 3) { score += 15; }
        }

        // Allergens & Additives
        var currentAllergens = 0;
        var currentAdditives = 0;
        
        if (ing) {
            for (var j = 0; j < commonAllergens.length; j++) {
                if (ing.includes(commonAllergens[j])) {
                    currentAllergens++;
                    allergensFound.push(commonAllergens[j]);
                }
            }
            var em = (ing.match(/e\s?\d{3}/gi) || []).map(function (x) { return x.toUpperCase().replace(/\s/g, ''); });
            for (var k = 0; k < em.length; k++) {
                if (additiveWatchlist[em[k]]) {
                    currentAdditives++;
                }
            }
        }

        if (currentAllergens > 0) { score += (currentAllergens * 5); }
        if (currentAdditives > 0) { score += (currentAdditives * 5); }

        // FSSAI, Origin, Nutrition
        if (!fssai) score += 5; else if (!/^\d{14}$/.test(fssai)) score += 10;
        if (origin !== 'India') score += 5;
        if (sugar > 22.5) score += 8;
        if (sodium > 800) score += 8;
        if (tempRanges[cat]) {
            if (tmin < tempRanges[cat][0] || tmax > tempRanges[cat][1]) score += 15;
        }

        score = clamp(Math.round(score), 0, 100);
        avgRiskScore += score;

        // Categorize Result
        var status = 'Moderate';
        var colorClass = 'badge-warn';
        if (score <= 30) { 
            status = 'Safe'; 
            colorClass = 'badge-safe';
            safeCount++; 
        } else if (score >= 70) { 
            status = 'Unsafe'; 
            colorClass = 'badge-risk';
            unsafeCount++; 
        } else {
            moderateCount++;
        }

        if (currentAllergens > 0) allergenCountTotal++;
        if (currentAdditives > 0) additiveCountTotal++;

        processedData.push({
            name: name,
            cat: cat,
            score: score,
            status: status,
            badge: colorClass,
            allergens: allergensFound.length,
            allergenNames: allergensFound.join(', ')
        });
    }

    avgRiskScore = Math.round(avgRiskScore / (total || 1));

    // --- GENERATE REPORT HTML ---
    
    // 1. Summary Dashboard (KPIs)
    html += '<div style="background:#fff; padding:20px; border-radius:12px; box-shadow:var(--shadow); margin-bottom:20px; border:1px solid var(--border);">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">';
    html += '<h3 style="margin:0; color:var(--text-dark);">📊 Batch Analysis Report</h3>';
    
    // CHANGED: Added ID to button, removed onclick
    html += '<button id="btn-download-batch" class="btn btn-primary" style="padding:8px 16px; font-size:0.9rem;"><i class="fas fa-download"></i> Download Results CSV</button>';
    
    html += '</div>';
    
    html += '<div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">';
    html += '<div class="kpi-card"><div class="kpi-title">Total Products</div><div class="kpi-value">' + total + '</div></div>';
    html += '<div class="kpi-card" style="border-color:#16a34a;"><div class="kpi-title">Safe</div><div class="kpi-value" style="color:#16a34a;">' + safeCount + '</div></div>';
    html += '<div class="kpi-card" style="border-color:#dc2626;"><div class="kpi-title">Unsafe</div><div class="kpi-value" style="color:#dc2626;">' + unsafeCount + '</div></div>';
    html += '<div class="kpi-card" style="border-color:#f59e0b;"><div class="kpi-title">Allergens</div><div class="kpi-value" style="color:#f59e0b;">' + allergenCountTotal + '</div></div>';
    html += '</div>';
    
    html += '<div style="margin-top:15px; font-size:0.9rem; color:var(--text-light);">Average Risk Score: ' + avgRiskScore + '/100</div>';
    html += '</div>';

    // 2. Detailed Table
    html += '<div class="card">';
    html += '<div class="card-header"><i class="fas fa-list"></i><h3>Detailed Results</h3></div>';
    html += '<div style="overflow-x:auto;"><table class="table" style="font-size:0.9rem;">';
    html += '<thead><tr><th>#</th><th>Product Name</th><th>Category</th><th>Score</th><th>Status</th><th>Allergens Found</th></tr></thead><tbody>';

    for (var i = 0; i < processedData.length; i++) {
        var item = processedData[i];
        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td>' + escapeHtml(item.name) + '</td>';
        html += '<td>' + escapeHtml(item.cat) + '</td>';
        html += '<td>' + item.score + '</td>';
        html += '<td><span class="badge ' + item.badge + '">' + item.status + '</span></td>';
        
        if (item.allergenNames && item.allergenNames.trim() !== '') {
            html += '<td style="color:#d97706; font-weight:500;"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(item.allergenNames) + '</td>';
        } else {
            html += '<td style="color:#059669;">None</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    html += '</div>';

    // Render to Page
    outDiv.innerHTML = html;
    
    // 3. Generate CSV String for Download
    var csvHeader = 'Name,Category,Score,Status,Allergens\n';
    var csvBody = processedData.map(function(row) {
        var safeName = (row.name || '').replace(/"/g, '""');
        var safeAllergens = (row.allergenNames || 'None').replace(/"/g, '""');
        return `"${safeName}","${row.cat}",${row.score},"${row.status}","${safeAllergens}"`;
    }).join('\n');
    
    window.lastBatchCSV = csvHeader + csvBody;

    // 4. EVENT LISTENER ATTACHMENT (The Fix)
    var dlBtn = document.getElementById('btn-download-batch');
    if(dlBtn) {
        dlBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Stop form submit
            window.downloadBatchCSV(); // Call global function
        });
    }
    
    // Scroll to results
    outDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
    // ========== EVENT LISTENERS ==========
    if (el('contactForm')) el('contactForm').addEventListener('submit', function (e) { e.preventDefault(); alert('Thank you! (Demo)'); this.reset(); });
    if (el('runBtn')) el('runBtn').addEventListener('click', runChecks);
    if (el('saveReview')) el('saveReview').addEventListener('click', saveReview);
    if (el('downloadHtml')) el('downloadHtml').addEventListener('click', downloadHTML);
    if (el('printReport')) el('printReport').addEventListener('click', function() {
    window.print();
});
if (el('p_ing')) {
    el('p_ing').addEventListener('input', function() {
        var text = this.value.toLowerCase();
        var alertDiv = el('liveIngredientAlert');
        if (!alertDiv) return;
        
        var foundAllergens = commonAllergens.filter(function(a) { return text.includes(a); });
        var foundHarmful = harmfulWords.filter(function(w) { return text.includes(w); });
        var foundE = (text.match(/e\s?\d{3}/gi) || []).map(function(x) { return x.toUpperCase().replace(/\s/g, ''); });
        
        if (foundAllergens.length === 0 && foundHarmful.length === 0 && foundE.length === 0) {
            alertDiv.innerHTML = '<span style="color:#059669;">✅ No immediate risks found in typed ingredients.</span>';
        } else {
            var html = '';
            if (foundAllergens.length) html += '<span style="color:#d97706;">⚠️ Allergens: ' + foundAllergens.join(', ') + '</span><br>';
            if (foundHarmful.length) html += '<span style="color:#dc2626;">🚨 Harmful: ' + foundHarmful.join(', ') + '</span><br>';
            if (foundE.length) html += '<span style="color:#7c3aed;">🧪 Additives (E-Numbers): ' + foundE.join(', ') + '</span>';
            alertDiv.innerHTML = html;
        }
    });
}
    if (el('downloadPdf')) el('downloadPdf').addEventListener('click', downloadPDF);

    if (el('demoBtn')) el('demoBtn').addEventListener('click', function () {
        if (el('p_name')) el('p_name').value = 'Classic Salted Chips';
        if (el('p_cat')) el('p_cat').value = 'Packaged Snack';
        if (el('p_exp')) el('p_exp').value = todayISO();
        if (el('p_ing')) el('p_ing').value = 'Potatoes, Edible Vegetable Oil, Salt, Flavour Enhancer (E621)';
        if (el('p_origin')) el('p_origin').value = 'India';
        if (el('n_kcal')) el('n_kcal').value = 540;
        if (el('n_sugar')) el('n_sugar').value = 1.2;
        if (el('n_sodium')) el('n_sodium').value = 580;
        if (el('fssai')) el('fssai').value = '12345678901234';
        validateInputs(); runChecks();
    });

    if (el('clearBtn')) el('clearBtn').addEventListener('click', function () {
        ['p_name', 'p_exp', 'p_ing', 'p_origin', 'n_kcal', 'n_sugar', 'n_sodium', 'n_sat', 'n_trans', 't_min', 't_max', 'fssai', 'lab_data', 'lab_limit', 'lab_sigma'].forEach(function (id) { if (el(id)) { el(id).value = ''; el(id).classList.remove('invalid'); } });
        ['k_overall', 'k_exp', 'k_add', 'k_all', 'k_origin', 'knn_out', 'lab_n', 'lab_mean', 'lab_sd'].forEach(function (id) { if (el(id)) el(id).textContent = '—'; });
        if (el('bullets')) el('bullets').innerHTML = '';
        if (el('verdict')) { el('verdict').textContent = '—'; el('verdict').className = 'badge'; }
        if (el('lab_summary')) { el('lab_summary').textContent = '—'; el('lab_summary').className = 'badge'; }
        if (el('lab_out')) el('lab_out').innerHTML = '';
        if (el('fopWarnings')) el('fopWarnings').style.display = 'none';
        if (el('imagePreview')) el('imagePreview').innerHTML = '';
        if (el('imageResult')) el('imageResult').style.display = 'none';
        initRiskChart(); initLabChart(); clearMLResults();
        if (el('barcodeResult')) el('barcodeResult').style.display = 'none';
if (el('manualBarcode')) el('manualBarcode').value = '';
    });

    if (el('runKnBtn')) el('runKnBtn').onclick = function () { var c = el('p_cat') ? el('p_cat').value : ''; var p = getDefaultParams(c); if (el('knn_out')) el('knn_out').innerText = knnPredict([p.ph, p.moisture, p.tmax]) ? "Safe" : "Unsafe"; };
    if (el('labRun')) el('labRun').addEventListener('click', runLabTest);
    if (el('labDemo')) el('labDemo').addEventListener('click', function () { if (el('lab_data')) el('lab_data').value = '580,590,585,600'; if (el('lab_limit')) el('lab_limit').value = 600; if (el('lab_sigma')) el('lab_sigma').value = ''; if (el('lab_alpha')) el('lab_alpha').value = '0.05'; validateInputs(); runLabTest(); });
    if (el('processCsvBtn')) el('processCsvBtn').addEventListener('click', function () { var f = el('csvFile') ? el('csvFile').files[0] : null; if (f) processCSV(f); else alert('Select CSV'); });
    if (el('csvFile')) el('csvFile').addEventListener('change', function () { if (this.files[0]) processCSV(this.files[0]); });
    if (el('exportCSV')) el('exportCSV').addEventListener('click', exportHistoryCSV);
    if (el('clearHistory')) el('clearHistory').addEventListener('click', clearHistory);
    if (el('runEDA')) el('runEDA').addEventListener('click', runEDA);
    if (el('runLinear')) el('runLinear').addEventListener('click', runLinearRegression);
    if (el('runLogistic')) el('runLogistic').addEventListener('click', runLogistic);
    if (el('runRidge')) el('runRidge').addEventListener('click', runRidge);
    if (el('runLasso')) el('runLasso').addEventListener('click', runLasso);
    if (el('runHist')) el('runHist').addEventListener('click', showHistograms);

    if (el('verifyFssai')) el('verifyFssai').addEventListener('click', function () {
        var n = el('fssai') ? el('fssai').value.trim() : '', s = el('fssaiStatus'); if (!s) return;
        if (!n) s.innerHTML = '<span style="color:#dc2626;">❌ Enter number</span>';
        else if (!/^\d{14}$/.test(n)) s.innerHTML = '<span style="color:#dc2626;">❌ 14 digits required</span>';
        else s.innerHTML = '<span style="color:#16a34a;">✅ Verified</span>';
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); var t = document.querySelector(this.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' }); }); });
    ['p_name', 'p_exp', 'fssai', 'lab_data', 'lab_limit'].forEach(function (id) { if (el(id)) el(id).addEventListener('input', validateInputs); });
    var mm = document.querySelector('.mobile-menu'); if (mm) mm.addEventListener('click', function () { var u = document.querySelector('nav ul'); if (u) u.classList.toggle('show'); });
    // ========== NEW SCROLL & UI FEATURES ==========
    
    // 1. Scroll Progress Bar
    window.addEventListener('scroll', function() {
        var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var scrolled = (winScroll / height) * 100;
        if(el('progressBar')) el('progressBar').style.width = scrolled + "%";
    });

    // 2. Scroll Reveal Animation
    function revealOnScroll() {
        var reveals = document.querySelectorAll(".reveal");
        reveals.forEach(function(div) {
            var windowHeight = window.innerHeight;
            var revealTop = div.getBoundingClientRect().top;
            if (revealTop < windowHeight - 100) div.classList.add("active");
        });
    }
    window.addEventListener("scroll", revealOnScroll);

    // 3. Active Nav Link on Scroll
    window.addEventListener('scroll', function() {
        var sections = document.querySelectorAll('section');
        var navLinks = document.querySelectorAll('nav a');
        var current = "";
        sections.forEach(function(section) {
            var sectionTop = section.offsetTop - 100;
            if (window.pageYOffset >= sectionTop) current = section.getAttribute('id');
        });
        navLinks.forEach(function(link) {
            link.classList.remove('active');
            if (link.getAttribute('href') == '#' + current) link.classList.add('active');
        });
    });

    // 4. Back to Top Button
    var topBtn = el('backToTop');
    if(topBtn) {
        window.addEventListener('scroll', function() {
            if (document.body.scrollTop > 500 || document.documentElement.scrollTop > 500) topBtn.style.display = "block";
            else topBtn.style.display = "none";
        });
        topBtn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
    // Disease Warning on Category Select
    var diseaseInfo = {
        "Meat & Poultry": "⚠️ High risk of Salmonella, E. coli if not cooked above 75°C.",
        "Seafood": "⚠️ Risk of Mercury, Vibrio bacteria. Ensure proper refrigeration.",
        "Dairy": "⚠️ Listeria & E. coli risk if kept above 5°C.",
        "Street Food": "⚠️ High risk of food poisoning, unhygienic water usage.",
        "Baby Food": "⚠️ Strictly check for added preservatives and heavy metals."
    };
    if (el('p_cat')) {
        el('p_cat').addEventListener('change', function() {
            var warningDiv = el('catWarning');
            if (!warningDiv) return;
            if (diseaseInfo[this.value]) {
                warningDiv.innerHTML = diseaseInfo[this.value];
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }
        });
    }

    var dt = el('darkToggle');
    if (dt) {
        if (localStorage.getItem('theme') === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); dt.innerHTML = '<i class="fas fa-sun"></i>'; }
        dt.addEventListener('click', function () { if (document.documentElement.getAttribute('data-theme') === 'dark') { document.documentElement.removeAttribute('data-theme'); dt.innerHTML = '<i class="fas fa-moon"></i>'; localStorage.setItem('theme', 'light'); } else { document.documentElement.setAttribute('data-theme', 'dark'); dt.innerHTML = '<i class="fas fa-sun"></i>'; localStorage.setItem('theme', 'dark'); } });
    }

    initRiskChart();
    initLabChart();
    var adulterantData = {
    "milk_water": { name: "Milk - Water Check", method: "Put a drop of milk on a polished slanted surface. Pure milk flows slowly leaving a white trail. Adulterated milk flows immediately without leaving a mark.", warning: "⚠️ If it flows fast, water is mixed." },
    "milk_starch": { name: "Milk - Starch Check", method: "Boil 2-3 ml of milk, cool it, and add 2-3 drops of Iodine solution.", warning: "⚠️ If it turns Blue-Black, starch is present." },
    "oil_argemone": { name: "Oil - Argemone Oil Check", method: "Take oil in a test tube, add concentrated Nitric Acid (HNO3) and shake gently.", warning: "⚠️ If reddish/brown color appears, Argemone oil (highly toxic) is present." },
    "honey_water": { name: "Honey - Water/Sugar Check", method: "Drop honey in a glass of water. Pure honey settles at the bottom forming a lump. Adulterated honey dissolves instantly.", warning: "⚠️ If it dissolves immediately, it has added water or sugar syrup." },
    "spice_wood": { name: "Spices - Wood Dust/Dye Check", method: "Take a small amount of spice in water. Artificial colored spices will immediately release color into the water.", warning: "⚠️ If water turns colored quickly, artificial dyes or sawdust is present." }
};

if(el('adulterant_test')) {
    el('adulterant_test').addEventListener('change', function() {
        var resDiv = el('adulterant_result');
        if(!this.value) { resDiv.style.display = 'none'; return; }
        var data = adulterantData[this.value];
        resDiv.style.display = 'block';
        resDiv.innerHTML = '<strong style="color:#15803d;">🧪 ' + data.name + '</strong><br><br><strong>Procedure:</strong> ' + data.method + '<br><br>' + data.warning;
    });
}
    renderHistory();
    // ======================
// DOWNLOAD BATCH RESULTS
// ======================

window.downloadBatchCSV = function() {
    if (!window.lastBatchCSV) {
        alert("No analysis data available to download.");
        return;
    }
    
    try {
        var blob = new Blob([window.lastBatchCSV], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        var url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'batch_analysis_results.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log("Download started successfully");
    } catch (err) {
        console.error("Download failed:", err);
        alert("Download failed. Please check console.");
    }
};

}); // END
