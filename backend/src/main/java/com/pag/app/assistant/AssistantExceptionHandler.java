package com.pag.app.assistant;

import java.util.Map;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Convierte los errores del asistente al formato { "message": "..." } que ya
 * usa el resto de la API. Solo aplica al AssistantController y tiene prioridad
 * sobre el manejador global (cuyos mensajes hablan del "formulario").
 */
@RestControllerAdvice(assignableTypes = AssistantController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AssistantExceptionHandler {

    @ExceptionHandler(AssistantException.class)
    public ResponseEntity<Map<String, Object>> handleAssistant(AssistantException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .findFirst()
                .orElse("La pregunta no es válida");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "La petición no es válida"));
    }
}
