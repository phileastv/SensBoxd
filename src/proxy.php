<?php

// Enable direct file logging for debugging
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/proxy_debug.log');

// Simple health check - if no X-Proxy-URL header, return status
if (!isset($_SERVER['HTTP_X_PROXY_URL']) && !isset($_REQUEST['csurl'])) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    echo json_encode([
        'status' => 'proxy_ready',
        'message' => 'SensBoxd Proxy is running',
        'timestamp' => date('Y-m-d H:i:s'),
        'method' => $_SERVER['REQUEST_METHOD'],
        'php_version' => phpversion()
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

/**
 * If set to true, $valid_requests should hold only domains i.e. a.example.com, b.example.com, usethisdomain.com
 * If set to false, $valid_requests should hold the whole URL ( without the parameters ) i.e. http://example.com/this/is/long/url/
 * Recommended value: false (for security reasons - do not forget that anyone can access your proxy)
 */
define('CSAJAX_FILTER_DOMAIN', true);

/**
 * Enables or disables Expect: 100-continue header. Some webservers don't 
 * handle this header correctly.
 * Recommended value: false
 */
define('CSAJAX_SUPPRESS_EXPECT', false);

/**
 * Set debugging to true to receive additional messages - really helpful on development
 */
define('CSAJAX_DEBUG', true);

/**
 * A set of valid cross domain requests
 */
$valid_requests = array(
    'localhost',
    'sensboxd.phileas.tv',
    'www.sensboxd.phileas.tv',
    'senscritique.com',
    'www.senscritique.com',
    'apollo.senscritique.com',
    'media.senscritique.com'
);

/**
 * Set extra multiple options for cURL
 * Could be used to define CURLOPT_SSL_VERIFYPEER & CURLOPT_SSL_VERIFYHOST for HTTPS
 * Also to overwrite any other options without changing the code
 * See http://php.net/manual/en/function.curl-setopt-array.php
 */
$curl_options = array(
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, // Force HTTP/1.1 to avoid HTTP/2 issues
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; SensBoxd-Proxy/1.0)',
    CURLOPT_ENCODING => 'identity', // Disable compression to avoid decoding issues
);

/* * * STOP EDITING HERE UNLESS YOU KNOW WHAT YOU ARE DOING * * */

// identify request headers
$request_headers = array( );
$seen_headers = array(); // Track headers we've already added

foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') === 0  ||  strpos($key, 'CONTENT_') === 0) {
        $headername = str_replace('_', ' ', str_replace('HTTP_', '', $key));
        $headername = str_replace(' ', '-', ucwords(strtolower($headername)));
        
        // Skip problematic headers that browsers block or that cause issues
        $blocked_headers = array('Host', 'X-Proxy-Url', 'Referer', 'Origin', 'Sec-Fetch-Dest', 'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'Sec-Gpc', 'Dnt', 'Accept-Encoding');
        if (!in_array($headername, $blocked_headers) && !isset($seen_headers[strtolower($headername)])) {
            $request_headers[] = "$headername: $value";
            $seen_headers[strtolower($headername)] = true;
        }
    }
}

// identify request method, url and params
$request_method = $_SERVER['REQUEST_METHOD'];
if ('GET' == $request_method) {
    $request_params = $_GET;
} elseif ('POST' == $request_method) {
    $request_params = $_POST;
    if (empty($request_params)) {
        $data = file_get_contents('php://input');
        if (!empty($data)) {
            $request_params = $data;
        }
    }
} elseif ('PUT' == $request_method || 'DELETE' == $request_method) {
    $request_params = file_get_contents('php://input');
} else {
    $request_params = null;
}

// Get URL from `csurl` in GET or POST data, before falling back to X-Proxy-URL header.
if (isset($_REQUEST['csurl'])) {
    $request_url = urldecode($_REQUEST['csurl']);
} elseif (isset($_SERVER['HTTP_X_PROXY_URL'])) {
    $request_url = urldecode($_SERVER['HTTP_X_PROXY_URL']);
} else {
    header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');
    header('Status: 404 Not Found');
    $_SERVER['REDIRECT_STATUS'] = 404;
    exit;
}

$p_request_url = parse_url($request_url);

// csurl may exist in GET request methods
if (is_array($request_params) && array_key_exists('csurl', $request_params)) {
    unset($request_params['csurl']);
}

// ignore requests for proxy :)
if (preg_match('!' . $_SERVER['SCRIPT_NAME'] . '!', $request_url) || empty($request_url) || count($p_request_url) == 1) {
    csajax_debug_message('Invalid request - make sure that csurl variable is not empty');
    exit;
}

// check against valid requests
if (CSAJAX_FILTERS) {
    $parsed = $p_request_url;
    if (CSAJAX_FILTER_DOMAIN) {
        if (!in_array($parsed['host'], $valid_requests)) {
            csajax_debug_message('Invalid domain - ' . $parsed['host'] . ' does not included in valid requests');
            exit;
        }
    } else {
        $check_url = isset($parsed['scheme']) ? $parsed['scheme'] . '://' : '';
        $check_url .= isset($parsed['user']) ? $parsed['user'] . ($parsed['pass'] ? ':' . $parsed['pass'] : '') . '@' : '';
        $check_url .= isset($parsed['host']) ? $parsed['host'] : '';
        $check_url .= isset($parsed['port']) ? ':' . $parsed['port'] : '';
        $check_url .= isset($parsed['path']) ? $parsed['path'] : '';
        if (!in_array($check_url, $valid_requests)) {
            csajax_debug_message('Invalid domain - ' . $request_url . ' does not included in valid requests');
            exit;
        }
    }
}

// append query string for GET requests
if ($request_method == 'GET' && count($request_params) > 0 && (!array_key_exists('query', $p_request_url) || empty($p_request_url['query']))) {
    $request_url .= '?' . http_build_query($request_params);
}

// let the request begin
$ch = curl_init($request_url);

// Debug: Log what we're sending
if (CSAJAX_DEBUG) {
    error_log("=== PROXY DEBUG ===");
    error_log("Target URL: " . $request_url);
    error_log("Request Method: " . $request_method);
    error_log("Request Headers: " . print_r($request_headers, true));
    error_log("Request Data: " . print_r($request_params, true));
    error_log("==================");
}

// Suppress Expect header
if (CSAJAX_SUPPRESS_EXPECT) {
    array_push($request_headers, 'Expect:'); 
}

// Add essential headers for SensCritique API and media
if (strpos($request_url, 'apollo.senscritique.com') !== false) {
    $request_headers[] = 'Referer: https://www.senscritique.com/';
    $request_headers[] = 'Origin: https://www.senscritique.com';
} elseif (strpos($request_url, 'media.senscritique.com') !== false) {
    $request_headers[] = 'Referer: https://www.senscritique.com/';
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);   // (re-)send headers
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);     // return response
curl_setopt($ch, CURLOPT_HEADER, true);       // enabled response headers
// add data for POST, PUT or DELETE requests
if ('POST' == $request_method) {
    $post_data = is_array($request_params) ? http_build_query($request_params) : $request_params;
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS,  $post_data);
} elseif ('PUT' == $request_method || 'DELETE' == $request_method) {
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $request_method);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $request_params);
}

// Set multiple options for curl according to configuration
if (is_array($curl_options) && 0 <= count($curl_options)) {
    curl_setopt_array($ch, $curl_options);
}

// retrieve response (headers and content)
$response = curl_exec($ch);
$curl_error = curl_error($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_info = curl_getinfo($ch);
curl_close($ch);

// Debug: Log response info
if (CSAJAX_DEBUG) {
    error_log("=== PROXY RESPONSE DEBUG ===");
    error_log("HTTP Code: " . $http_code);
    error_log("cURL Error: " . $curl_error);
    error_log("Response Length: " . strlen($response));
    error_log("cURL Info: " . print_r($curl_info, true));
    error_log("============================");
}

// Handle cURL errors
if ($response === false || !empty($curl_error)) {
    // If it's an HTTP/2 protocol error, try again with HTTP/1.0
    if (strpos($curl_error, 'HTTP/2') !== false || strpos($curl_error, 'PROTOCOL_ERROR') !== false) {
        error_log("HTTP/2 error detected, retrying with HTTP/1.0");
        
        // Retry with HTTP/1.0
        $ch_retry = curl_init($request_url);
        curl_setopt($ch_retry, CURLOPT_HTTPHEADER, $request_headers);
        curl_setopt($ch_retry, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch_retry, CURLOPT_HEADER, true);
        curl_setopt($ch_retry, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_0);
        curl_setopt($ch_retry, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch_retry, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch_retry, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch_retry, CURLOPT_CONNECTTIMEOUT, 10);
        
        if ('POST' == $request_method) {
            $post_data = is_array($request_params) ? http_build_query($request_params) : $request_params;
            curl_setopt($ch_retry, CURLOPT_POST, true);
            curl_setopt($ch_retry, CURLOPT_POSTFIELDS, $post_data);
        }
        
        $response = curl_exec($ch_retry);
        $curl_error = curl_error($ch_retry);
        $http_code = curl_getinfo($ch_retry, CURLINFO_HTTP_CODE);
        curl_close($ch_retry);
        
        if ($response === false || !empty($curl_error)) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(array(
                'error' => 'Proxy cURL Error (after retry)',
                'message' => $curl_error,
                'http_code' => $http_code
            ));
            exit;
        }
    } else {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(array(
            'error' => 'Proxy cURL Error',
            'message' => $curl_error,
            'http_code' => $http_code
        ));
        exit;
    }
}

// Add CORS headers for HTTPS compatibility
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Proxy-URL');
header('Access-Control-Max-Age: 86400');

// Ensure proper content type for different response types
if (strpos($request_url, 'apollo.senscritique.com') !== false) {
    header('Content-Type: application/json; charset=utf-8');
} elseif (strpos($request_url, 'media.senscritique.com') !== false) {
    // For images, let the original content-type header pass through
    // We'll handle this in the header processing below
}

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// split response to header and content
$response_parts = preg_split('/(\r\n){2}/', $response, 2);
if (count($response_parts) < 2) {
    // If we can't split headers and content, treat entire response as content
    $response_headers = '';
    $response_content = $response;
} else {
    list($response_headers, $response_content) = $response_parts;
}

// (re-)send the headers
if (!empty($response_headers)) {
    $response_headers_array = preg_split('/(\r\n){1}/', $response_headers);
    foreach ($response_headers_array as $key => $response_header) {
        // Skip empty headers
        if (empty(trim($response_header))) {
            continue;
        }
        
        // Rewrite the `Location` header, so clients will also use the proxy for redirects.
        if (preg_match('/^Location:/', $response_header)) {
            list($header, $value) = preg_split('/: /', $response_header, 2);
            $response_header = 'Location: ' . $_SERVER['REQUEST_URI'] . '?csurl=' . $value;
        }
        // Skip problematic headers that we've already set or that cause issues
        // For images, allow Content-Type to pass through
        if (strpos($request_url, 'media.senscritique.com') !== false) {
            if (!preg_match('/^(Transfer-Encoding|Access-Control-Allow|Content-Encoding|Content-Length):/', $response_header)) {
                header($response_header, false);
            }
        } else {
            if (!preg_match('/^(Transfer-Encoding|Access-Control-Allow|Content-Encoding|Content-Length):/', $response_header)) {
                header($response_header, false);
            }
        }
    }
}

// Debug: Log final response
if (CSAJAX_DEBUG) {
    error_log("=== FINAL RESPONSE DEBUG ===");
    error_log("Response Content Length: " . strlen($response_content));
    error_log("Response Content Preview: " . substr($response_content, 0, 200));
    error_log("============================");
}

// Check if response contains GraphQL errors and log them
if (strpos($response_content, '"errors"') !== false) {
    $json_response = json_decode($response_content, true);
    if ($json_response && isset($json_response['errors'])) {
        error_log("=== GRAPHQL ERRORS DETECTED ===");
        error_log("GraphQL Errors: " . print_r($json_response['errors'], true));
        error_log("===============================");
    }
}

// finally, output the content
print($response_content);

function csajax_debug_message($message)
{
    if (true == CSAJAX_DEBUG) {
        print $message . PHP_EOL;
    }
}
