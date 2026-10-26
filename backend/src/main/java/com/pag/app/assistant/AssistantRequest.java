package com.pag.app.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Cuerpo de POST /api/assistant.
 *
 * @param question lo que el usuario pregunta
 * @param context  descripcion de lo que el usuario esta viendo (opcional)
 */
public record AssistantRequest(
        @NotBlank(message = "Escribe una pregunta")
        @Size(max = 500, message = "La pregunta no puede superar los 500 caracteres")
        String question,

        @Size(max = 4000, message = "El contexto es demasiado largo")
        String context) {
}
