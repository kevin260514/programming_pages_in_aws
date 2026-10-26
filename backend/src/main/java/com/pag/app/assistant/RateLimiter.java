package com.pag.app.assistant;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Limite de preguntas por cliente y por minuto (ventana fija, en memoria).
 * Protege la cuota gratuita de Gemini cuando la pagina esta publicada.
 */
@Component
public class RateLimiter {

    private record Window(long start, int count) {
    }

    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final int maxRequests;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Autowired
    public RateLimiter(@Value("${assistant.rate-limit.per-minute:10}") int maxRequests) {
        this(maxRequests, 60_000L, System::currentTimeMillis);
    }

    RateLimiter(int maxRequests, long windowMillis, LongSupplier clock) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    /** @return true si el cliente todavia puede preguntar en esta ventana */
    public boolean tryAcquire(String clientKey) {
        long now = clock.getAsLong();
        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.entrySet().removeIf(entry -> now - entry.getValue().start() >= windowMillis);
        }
        Window window = windows.compute(clientKey, (key, current) -> {
            if (current == null || now - current.start() >= windowMillis) {
                return new Window(now, 1);
            }
            return new Window(current.start(), current.count() + 1);
        });
        return window.count() <= maxRequests;
    }
}
