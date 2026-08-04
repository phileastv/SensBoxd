<?php

// Log les erreurs dans un fichier au lieu de les envoyer dans la réponse HTTP
// (sinon les deprecation warnings de PHP 8.5+ cassent le parsing JSON côté client).
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/proxy_debug.log');

// Auto-diagnostic
if (!isset($_SERVER['HTTP_X_PROXY_URL']) && !isset($_REQUEST['csurl'])) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    echo json_encode([
        'status' => 'proxy_ready',
        'message' => 'SensBoxd Proxy is running',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

/**
 * AJAX Cross Domain (PHP) Proxy 0.8
 * Copyright (C) 2016 Iacovos Constantinou (https://github.com/softius)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Enables or disables filtering for cross domain requests.
 * Recommended value: true
 */

define('CSAJAX_FILTERS', true);
define('CSAJAX_FILTER_DOMAIN', true);
define('CSAJAX_DEBUG', false);

$valid_requests = array(
    'localhost',
    'sensboxd.phileas.tv',
    'www.sensboxd.phileas.tv',
    'senscritique.com',
    'www.senscritique.com',
    'apollo.senscritique.com',
    'media.senscritique.com'
);

// Obtenir l'URL cible
if (isset($_REQUEST['csurl'])) {
    $request_url = urldecode($_REQUEST['csurl']);
} elseif (isset($_SERVER['HTTP_X_PROXY_URL'])) {
    $request_url = urldecode($_SERVER['HTTP_X_PROXY_URL']);
} else {
    header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');
    exit;
}

$p_request_url = parse_url($request_url);

// Vérification de sécurité du domaine
if (CSAJAX_FILTERS && !in_array($p_request_url['host'], $valid_requests)) {
    header($_SERVER['SERVER_PROTOCOL'] . ' 403 Forbidden');
    echo "Domain not allowed";
    exit;
}

$request_method = $_SERVER['REQUEST_METHOD'];
$request_params = null;

if ('GET' == $request_method) {
    $request_params = $_GET;
    if (is_array($request_params) && array_key_exists('csurl', $request_params)) {
        unset($request_params['csurl']);
    }
    if (count($request_params) > 0) {
        $request_url .= (strpos($request_url, '?') === false ? '?' : '&') . http_build_query($request_params);
    }
} else {
    $request_params = file_get_contents('php://input');
}

$ch = curl_init($request_url);

// Déterminer s'il s'agit d'une image ou d'une requête API
$is_media = (strpos($request_url, 'media.senscritique.com') !== false);

if ($is_media) {
    // En-têtes simplifiés et propres pour le téléchargement d'images
    $headers = array(
        'Host: media.senscritique.com',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0',
        'Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer: https://www.senscritique.com/',
        'Connection: keep-alive'
    );
} else {
    // En-têtes pour les requêtes GraphQL Apollo
    $headers = array(
        'Host: apollo.senscritique.com',
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0',
        'Accept: */*',
        'Accept-Language: fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type: application/json',
        'authorization: null',
        'Origin: https://www.senscritique.com',
        'Referer: https://www.senscritique.com/',
        'Connection: keep-alive'
    );
}

// Configuration de cURL
$curl_options = array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_ENCODING => 'gzip, deflate'
);

if ('POST' == $request_method && !$is_media) {
    $curl_options[CURLOPT_POST] = true;
    $curl_options[CURLOPT_POSTFIELDS] = $request_params;
}

curl_setopt_array($ch, $curl_options);

$response = curl_exec($ch);
$curl_error = curl_error($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
// curl_close() is deprecated since PHP 8.5 (handles are auto-freed by GC).
// Keep the call for older PHP versions but silence the deprecation warning.
if (PHP_VERSION_ID < 80500) {
    @curl_close($ch);
}

// CORS headers pour le client JS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Proxy-URL');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($response === false) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(array('error' => 'Proxy Error', 'message' => $curl_error));
    exit;
}

// Extraction propre des en-têtes et du contenu binaire
list($response_headers, $response_content) = preg_split('/(\r\n){2}/', $response, 2);

if ($is_media) {
    // Détecter l'extension pour renvoyer le bon en-tête image
    $ext = pathinfo(parse_url($request_url, PHP_URL_PATH), PATHINFO_EXTENSION);
    if ($ext === 'png') {
        header('Content-Type: image/png');
    } elseif ($ext === 'gif') {
        header('Content-Type: image/gif');
    } else {
        header('Content-Type: image/jpeg');
    }
} else {
    header('Content-Type: application/json; charset=utf-8');
}

print($response_content);
