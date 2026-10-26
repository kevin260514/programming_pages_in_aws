package com.pag.app.assistant;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Contexto aparte con un limite de 2 preguntas por minuto. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
@TestPropertySource(properties = "assistant.rate-limit.per-minute=2")
class AssistantRateLimitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GeminiClient geminiClient;

    @Test
    void laTerceraPreguntaDelMismoClienteRecibe429() throws Exception {
        when(geminiClient.generate(anyString(), anyString())).thenReturn("ok");
        String body = "{\"question\": \"Hola\"}";

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/assistant").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(post("/api/assistant").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
    }
}
