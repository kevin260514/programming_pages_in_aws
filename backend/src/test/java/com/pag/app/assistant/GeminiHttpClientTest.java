package com.pag.app.assistant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;

/**
 * Prueba el cliente contra un servidor HTTP local que hace de Gemini:
 * no usa internet ni la clave real.
 */
class GeminiHttpClientTest {

    private HttpServer server;
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> apiKeyHeader = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    /** Levanta el Gemini falso y devuelve su URL base. */
    private String gemini(int status, String responseBody, long delayMillis) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            apiKeyHeader.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            try {
                Thread.sleep(delayMillis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            } catch (IOException ignored) {
                // el cliente ya se fue (prueba de tiempo agotado)
            }
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/v1beta";
    }

    private GeminiHttpClient client(String baseUrl, String key, long timeoutSeconds) {
        return new GeminiHttpClient(new ObjectMapper(), key, "modelo-prueba", baseUrl, timeoutSeconds);
    }

    private AssistantException failure(GeminiHttpClient client) {
        return assertThrows(AssistantException.class, () -> client.generate("reglas", "hola"));
    }

    @Test
    void devuelveElTextoYEnviaLaPeticionCorrecta() throws Exception {
        String url = gemini(200, """
                {"candidates":[{"content":{"parts":[{"text":"Charmander es de tipo Fuego."}]}}]}
                """, 0);

        String answer = client(url, "clave-secreta", 5).generate("Eres un asistente", "¿Qué tipo es?");

        assertEquals("Charmander es de tipo Fuego.", answer);
        assertEquals("/v1beta/models/modelo-prueba:generateContent", path.get());
        assertEquals("clave-secreta", apiKeyHeader.get());
        assertTrue(body.get().contains("Eres un asistente"));
        assertTrue(body.get().contains("¿Qué tipo es?"));
        assertTrue(body.get().contains("systemInstruction"));
        assertTrue(body.get().contains("generationConfig"));
    }

    @Test
    void ignoraLasPartesDePensamientoYUneElResto() throws Exception {
        String url = gemini(200, """
                {"candidates":[{"content":{"parts":[
                  {"text":"razonamiento interno","thought":true},
                  {"text":"Hola "},{"text":"mundo"}]}}]}
                """, 0);

        assertEquals("Hola mundo", client(url, "k", 5).generate("s", "p"));
    }

    @Test
    void sinClaveNoLlamaAGemini() {
        AssistantException ex = failure(client("http://127.0.0.1:1/v1beta", "  ", 5));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertTrue(ex.getMessage().contains("GEMINI_API_KEY"));
    }

    @Test
    void limiteDeUsoSeTraduceAError429() throws Exception {
        String url = gemini(429, "{\"error\":{\"message\":\"quota\"}}", 0);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, failure(client(url, "k", 5)).getStatus());
    }

    @Test
    void claveRechazadaIndicaQueRevisarLaConfiguracion() throws Exception {
        String url = gemini(400, "{\"error\":{\"message\":\"API key not valid\"}}", 0);

        AssistantException ex = failure(client(url, "k", 5));

        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatus());
        assertTrue(ex.getMessage().contains("GEMINI_API_KEY"));
        assertTrue(!ex.getMessage().contains("API key not valid"), "no debe filtrar el detalle de Google");
    }

    @Test
    void modeloInexistenteMencionaElNombre() throws Exception {
        String url = gemini(404, "{}", 0);

        AssistantException ex = failure(client(url, "k", 5));

        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatus());
        assertTrue(ex.getMessage().contains("modelo-prueba"));
    }

    @Test
    void errorInternoDeGeminiEsBadGateway() throws Exception {
        String url = gemini(500, "boom", 0);

        AssistantException ex = failure(client(url, "k", 5));

        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatus());
        assertTrue(ex.getMessage().contains("500"));
    }

    @Test
    void contenidoBloqueadoEsUnErrorDeEntrada() throws Exception {
        String url = gemini(200, "{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}", 0);

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, failure(client(url, "k", 5)).getStatus());
    }

    @Test
    void respuestaVaciaEsBadGateway() throws Exception {
        String url = gemini(200, "{\"candidates\":[]}", 0);

        assertEquals(HttpStatus.BAD_GATEWAY, failure(client(url, "k", 5)).getStatus());
    }

    @Test
    void respuestaQueNoEsJsonEsBadGateway() throws Exception {
        String url = gemini(200, "<html>no soy json</html>", 0);

        assertEquals(HttpStatus.BAD_GATEWAY, failure(client(url, "k", 5)).getStatus());
    }

    @Test
    void sinConexionEsBadGateway() {
        // puerto 1: nadie escucha
        assertEquals(HttpStatus.BAD_GATEWAY, failure(client("http://127.0.0.1:1/v1beta", "k", 5)).getStatus());
    }

    @Test
    void tiempoAgotadoEsGatewayTimeout() throws Exception {
        String url = gemini(200, "{}", 3000);

        assertEquals(HttpStatus.GATEWAY_TIMEOUT, failure(client(url, "k", 1)).getStatus());
    }

    @Test
    void rechazaNombresDeModeloPeligrosos() {
        assertThrows(IllegalArgumentException.class,
                () -> new GeminiHttpClient(new ObjectMapper(), "k", "../otro?x=1", "http://x/v1beta", 5));
    }
}
