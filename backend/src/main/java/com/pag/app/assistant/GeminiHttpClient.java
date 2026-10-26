package com.pag.app.assistant;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Cliente HTTP de la API de Gemini (metodo generateContent).
 *
 * La clave se lee de la variable de entorno GEMINI_API_KEY (propiedad
 * gemini.api-key) y solo existe en el servidor: nunca se envia al navegador.
 * Si Google cambia el formato de su API, este es el unico archivo a modificar.
 */
@Component
public class GeminiHttpClient implements GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiHttpClient.class);
    private static final Pattern MODEL_NAME = Pattern.compile("[A-Za-z0-9._-]+");

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final Duration timeout;
    private final int retries;
    private final long retryDelayMillis;

    public GeminiHttpClient(
            ObjectMapper mapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-3.8-flash}") String model,
            @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta}") String baseUrl,
            @Value("${gemini.timeout-seconds:20}") long timeoutSeconds,
            @Value("${gemini.retries:2}") int retries,
            @Value("${gemini.retry-delay-ms:1000}") long retryDelayMillis) {
        if (!MODEL_NAME.matcher(model).matches()) {
            throw new IllegalArgumentException("Nombre de modelo no valido: " + model);
        }
        this.mapper = mapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.retries = retries;
        this.retryDelayMillis = retryDelayMillis;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    @Override
    public String generate(String systemInstruction, String userPrompt) {
        if (apiKey.isEmpty()) {
            throw new AssistantException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El asistente no está configurado: falta GEMINI_API_KEY en el servidor.");
        }

        HttpRequest request = HttpRequest.newBuilder(
                        URI.create(baseUrl + "/models/" + model + ":generateContent"))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(buildBody(systemInstruction, userPrompt)))
                .build();

        HttpResponse<String> response = send(request);
        // 503 = modelo saturado: suele ser momentáneo, se reintenta con una pausa creciente
        for (int attempt = 0; response.statusCode() == 503 && attempt < retries; attempt++) {
            log.info("Gemini saturado (503), reintento {} de {}", attempt + 1, retries);
            pause(retryDelayMillis * (attempt + 1));
            response = send(request);
        }

        return readAnswer(response);
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            throw new AssistantException(HttpStatus.GATEWAY_TIMEOUT,
                    "Gemini tardó demasiado en responder. Inténtalo de nuevo.");
        } catch (IOException e) {
            log.warn("No se pudo conectar con Gemini: {}", e.toString());
            throw new AssistantException(HttpStatus.BAD_GATEWAY,
                    "No se pudo conectar con Gemini. Revisa la conexión a internet del servidor.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssistantException(HttpStatus.BAD_GATEWAY, "La consulta a Gemini fue interrumpida.");
        }
    }

    private static void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssistantException(HttpStatus.BAD_GATEWAY, "La consulta a Gemini fue interrumpida.");
        }
    }

    private String buildBody(String systemInstruction, String userPrompt) {
        ObjectNode root = mapper.createObjectNode();

        root.putObject("systemInstruction")
                .putArray("parts").addObject().put("text", systemInstruction);

        ObjectNode content = root.putArray("contents").addObject();
        content.put("role", "user");
        content.putArray("parts").addObject().put("text", userPrompt);

        ObjectNode config = root.putObject("generationConfig");
        config.put("maxOutputTokens", 700);
        config.put("temperature", 0.4);

        return root.toString();
    }

    private String readAnswer(HttpResponse<String> response) {
        int status = response.statusCode();

        if (status == 429) {
            throw new AssistantException(HttpStatus.TOO_MANY_REQUESTS,
                    "Se alcanzó el límite de uso del plan gratuito de Gemini. Espera un momento e inténtalo de nuevo.");
        }
        if (status == 503) {
            throw new AssistantException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El modelo de Gemini está saturado en este momento. Inténtalo de nuevo en unos segundos.");
        }
        if (status < 200 || status >= 300) {
            log.warn("Gemini respondio HTTP {}: {}", status, shorten(response.body(), 300));
            if (status == 400 || status == 401 || status == 403) {
                throw new AssistantException(HttpStatus.BAD_GATEWAY,
                        "Gemini rechazó la solicitud. Revisa GEMINI_API_KEY y el modelo configurado (GEMINI_MODEL).");
            }
            if (status == 404) {
                throw new AssistantException(HttpStatus.BAD_GATEWAY,
                        "Gemini no encontró el modelo '" + model + "'. Revisa GEMINI_MODEL.");
            }
            throw new AssistantException(HttpStatus.BAD_GATEWAY,
                    "Gemini no está disponible en este momento (HTTP " + status + ").");
        }

        JsonNode root;
        try {
            root = mapper.readTree(response.body());
        } catch (IOException e) {
            throw new AssistantException(HttpStatus.BAD_GATEWAY, "Gemini devolvió una respuesta ilegible.");
        }

        StringBuilder text = new StringBuilder();
        for (JsonNode part : root.path("candidates").path(0).path("content").path("parts")) {
            if (!part.path("thought").asBoolean(false)) {
                text.append(part.path("text").asText(""));
            }
        }
        if (text.toString().isBlank()) {
            String blocked = root.path("promptFeedback").path("blockReason").asText("");
            if (!blocked.isEmpty()) {
                throw new AssistantException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Gemini no pudo responder a esa pregunta. Prueba con otra formulación.");
            }
            throw new AssistantException(HttpStatus.BAD_GATEWAY, "Gemini devolvió una respuesta vacía.");
        }
        return text.toString().trim();
    }

    private static String shorten(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() <= max ? text : text.substring(0, max) + "...";
    }
}
