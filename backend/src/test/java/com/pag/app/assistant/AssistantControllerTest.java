package com.pag.app.assistant;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;


/** Prueba el endpoint con Gemini simulado: no consume la API real. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
@TestPropertySource(properties = "assistant.rate-limit.per-minute=1000")
class AssistantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GeminiClient geminiClient;

    private String json(String question, String context) {
        return """
                {"question": "%s", "context": "%s"}
                """.formatted(question, context);
    }

    @Test
    void respondeConLaRespuestaDeGemini() throws Exception {
        when(geminiClient.generate(anyString(), anyString())).thenReturn("Es de tipo Fuego.");

        mockMvc.perform(post("/api/assistant")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("Que tipo es", "Charmander: Fuego")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("Es de tipo Fuego."));

        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(geminiClient).generate(anyString(), prompt.capture());
        assertTrue(prompt.getValue().contains("Charmander: Fuego"));
        assertTrue(prompt.getValue().contains("Que tipo es"));
    }

    @Test
    void rechazaUnaPreguntaVacia() throws Exception {
        mockMvc.perform(post("/api/assistant")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("   ", "algo")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Escribe una pregunta")));
    }

    @Test
    void rechazaUnContextoDemasiadoLargo() throws Exception {
        mockMvc.perform(post("/api/assistant")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("Hola", "a".repeat(4001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("demasiado largo")));
    }

    @Test
    void rechazaUnCuerpoQueNoEsJson() throws Exception {
        mockMvc.perform(post("/api/assistant")
                .contentType(MediaType.APPLICATION_JSON)
                .content("esto no es json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void trasladaElErrorControladoDeGemini() throws Exception {
        when(geminiClient.generate(anyString(), anyString()))
                .thenThrow(new AssistantException(HttpStatus.SERVICE_UNAVAILABLE, "falta GEMINI_API_KEY"));

        mockMvc.perform(post("/api/assistant")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("Hola", "")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message", containsString("GEMINI_API_KEY")));
    }
}
