---
name: java-spring-boot-app
description: Build and structure Java Spring Boot applications with modern best practices. Use when creating REST APIs, entities, repositories, services, controllers, DTOs, custom validators, or when the user asks about Java project structure, Spring Boot patterns, or backend architecture.
---

# Java Spring Boot Application

Patterns and best practices for building production-ready Spring Boot applications with layered architecture.

## Project Structure

```
src/
├── main/
│   ├── java/com/company/
│   │   ├── Application.java           # Main entry point
│   │   ├── config/                     # Configuration classes
│   │   │   ├── WebConfig.java
│   │   │   └── SecurityConfig.java
│   │   ├── controller/                 # REST controllers (HTTP layer)
│   │   │   └── PersonController.java
│   │   ├── service/                    # Business logic
│   │   │   └── PersonService.java
│   │   ├── repository/                 # Data access (JPA repositories)
│   │   │   └── PersonRepository.java
│   │   ├── domain/                     # JPA entities
│   │   │   └── Person.java
│   │   ├── dto/                        # Data Transfer Objects
│   │   │   ├── PersonCreateRequest.java
│   │   │   ├── PersonUpdateRequest.java
│   │   │   └── PersonResponse.java
│   │   └── validation/                 # Custom validators
│   │       ├── ValidDateRange.java
│   │       └── ValidDateRangeValidator.java
│   └── resources/
│       ├── application.yml             # Configuration
│       └── db/migration/               # Flyway migrations
│           └── V1__initial_schema.sql
└── test/
    └── java/com/company/
        └── controller/
            └── PersonControllerTest.java
```

## Maven Configuration (pom.xml)

Essential dependencies for a Spring Boot project:

```xml
<properties>
    <java.version>21</java.version>
    <spring.boot.version>3.2.0</spring.boot.version>
</properties>

<dependencies>
    <!-- Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- JPA & Database -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>
    
    <!-- Validation -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    
    <!-- Database Migrations -->
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
    </dependency>
    
    <!-- API Documentation -->
    <dependency>
        <groupId>org.springdoc</groupId>
        <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
        <version>2.6.0</version>
    </dependency>
    
    <!-- Testing -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>postgresql</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

## Project Files

### .gitignore

```gitignore
# Build output
target/

# IDE files
.idea/
*.iml
.project
.classpath
.settings/
.vscode/
*.swp
*.swo

# Environment and secrets
.env
*.env
application-local.yml

# Logs
*.log
logs/

# OS files
.DS_Store
Thumbs.db

# Package files
*.jar
*.war
*.ear

# Test output
test-output/
```

### .dockerignore

```dockerignore
# Build output (rebuilt in container)
target/

# IDE files
.idea/
*.iml
.project
.classpath
.settings/
.vscode/

# Git
.git/
.gitignore

# Documentation
*.md
!README.md

# Environment files
.env*
application-local.yml

# Logs
*.log
logs/

# Test files
src/test/
```

### Dockerfile (Multi-stage build)

```dockerfile
# Build stage
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copy pom.xml and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests -B

# Production stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S spring && \
    adduser -S spring -u 1001 -G spring

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Set ownership
RUN chown -R spring:spring /app

# Switch to non-root user
USER spring

# Expose port
EXPOSE 8080

# JVM tuning for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myapp
      - SPRING_DATASOURCE_USERNAME=postgres
      - SPRING_DATASOURCE_PASSWORD=postgres
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    ports:
      - "5432:5432"  # Expose for local development

volumes:
  postgres_data:
```

### Dockerfile.layered (Optimized for Spring Boot)

For better caching with Spring Boot's layered JARs:

```dockerfile
# Build stage
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B && \
    java -Djarmode=layertools -jar target/*.jar extract

# Production stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -g 1001 -S spring && \
    adduser -S spring -u 1001 -G spring

# Copy layers in order of change frequency (least → most)
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./

RUN chown -R spring:spring /app
USER spring

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]
```

## Controller Layer

Controllers handle HTTP concerns only - delegate business logic to services.

```java
package com.company.controller;

import com.company.dto.*;
import com.company.service.PersonService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/people")
public class PersonController {

    private final PersonService personService;

    // Constructor injection (preferred over @Autowired)
    public PersonController(PersonService personService) {
        this.personService = personService;
    }

    @GetMapping
    public List<PersonResponse> list(@RequestParam(value = "q", required = false) String query) {
        return personService.listPeople(query);
    }

    @GetMapping("/{id}")
    public PersonResponse get(@PathVariable UUID id) {
        return personService.getPerson(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PersonResponse create(@Valid @RequestBody PersonCreateRequest request) {
        return personService.createPerson(request);
    }

    @PutMapping("/{id}")
    public PersonResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody PersonUpdateRequest request) {
        return personService.updatePerson(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        personService.deletePerson(id);
    }
}
```

**Key patterns:**
- Constructor injection (not field `@Autowired`)
- `@Valid` for request body validation
- Appropriate HTTP status codes (`@ResponseStatus`)
- API versioning in path (`/api/v1/`)
- UUID for entity IDs

## Service Layer

Services contain business logic, transactions, and domain orchestration.

```java
package com.company.service;

import com.company.domain.Person;
import com.company.dto.*;
import com.company.repository.PersonRepository;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PersonService {

    private static final Logger logger = LoggerFactory.getLogger(PersonService.class);

    private final PersonRepository personRepository;

    public PersonService(PersonRepository personRepository) {
        this.personRepository = personRepository;
    }

    @Transactional(readOnly = true)
    public List<PersonResponse> listPeople(String query) {
        List<Person> people = (query == null || query.isBlank())
            ? personRepository.findAll()
            : personRepository.findByNameContainingIgnoreCase(query);
        return people.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PersonResponse getPerson(UUID id) {
        return personRepository.findById(id)
            .map(this::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Person not found"));
    }

    @Transactional
    public PersonResponse createPerson(PersonCreateRequest request) {
        // Business validation
        personRepository.findByEmailIgnoreCase(request.email()).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        });

        Person person = new Person();
        applyRequest(person, request);
        Person saved = personRepository.save(person);
        
        logger.info("person.created id={} email={}", saved.getId(), saved.getEmail());
        return toResponse(saved);
    }

    @Transactional
    public PersonResponse updatePerson(UUID id, PersonUpdateRequest request) {
        Person person = personRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Person not found"));

        // Check email uniqueness if changed
        if (!person.getEmail().equalsIgnoreCase(request.email())) {
            personRepository.findByEmailIgnoreCase(request.email()).ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
            });
        }

        applyRequest(person, request);
        Person saved = personRepository.save(person);
        
        logger.info("person.updated id={}", saved.getId());
        return toResponse(saved);
    }

    @Transactional
    public void deletePerson(UUID id) {
        if (!personRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Person not found");
        }
        personRepository.deleteById(id);
        logger.info("person.deleted id={}", id);
    }

    private void applyRequest(Person person, PersonCreateRequest request) {
        person.setName(request.name());
        person.setEmail(request.email());
        // ... map other fields
    }

    private PersonResponse toResponse(Person person) {
        return new PersonResponse(
            person.getId(),
            person.getName(),
            person.getEmail()
            // ... map other fields
        );
    }
}
```

**Key patterns:**
- `@Transactional(readOnly = true)` for read operations
- `@Transactional` for write operations
- `ResponseStatusException` for HTTP error responses
- Structured logging with context (`id={}`)
- Private helper methods for mapping

## Entity Layer (JPA)

```java
package com.company.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "people")
public class Person extends AuditableEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PersonStatus status;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToMany
    @JoinTable(
        name = "person_skills",
        joinColumns = @JoinColumn(name = "person_id"),
        inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> skills = new HashSet<>();

    // Getters and setters
    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    // ...
}
```

**Key patterns:**
- Use `UUID` for IDs (better for distributed systems)
- `@Enumerated(EnumType.STRING)` for enums (not ORDINAL)
- `FetchType.LAZY` for relationships
- Explicit `@Column` names matching snake_case DB convention
- Extend `AuditableEntity` for created/updated timestamps

### Auditable Base Entity

```java
@MappedSuperclass
public abstract class AuditableEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters
}
```

## Repository Layer

```java
package com.company.repository;

import com.company.domain.Person;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonRepository extends JpaRepository<Person, UUID> {

    // Derived query methods
    List<Person> findByNameContainingIgnoreCase(String name);
    
    Optional<Person> findByEmailIgnoreCase(String email);
    
    List<Person> findByDepartmentId(UUID departmentId);
    
    boolean existsByEmail(String email);
}
```

**Key patterns:**
- Extend `JpaRepository<Entity, IdType>`
- Use derived query methods when simple
- Return `Optional` for single results that may not exist
- Use `IgnoreCase` for case-insensitive searches

## DTO Layer (Records)

Use Java Records for immutable DTOs with built-in validation.

### Request DTO

```java
package com.company.dto;

import com.company.validation.ValidDateRange;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

@ValidDateRange  // Custom class-level validator
public record PersonCreateRequest(
    @NotBlank String name,
    @NotBlank @Email String email,
    String designation,
    @NotNull PersonStatus status,
    @NotNull @DecimalMin("0.0") @DecimalMax("10000.0") BigDecimal salary,
    @NotNull LocalDate startDate,
    LocalDate endDate,  // Optional
    List<String> skills
) {}
```

### Response DTO

```java
package com.company.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PersonResponse(
    UUID id,
    String name,
    String email,
    String designation,
    PersonStatus status,
    BigDecimal salary,
    LocalDate startDate,
    LocalDate endDate,
    List<String> skills,
    String departmentName  // Flattened from relationship
) {}
```

**Key patterns:**
- Use Java Records (immutable, concise)
- Separate Create/Update request DTOs
- Response DTOs flatten relationships
- Validation annotations on request fields

## Custom Validation

### Annotation

```java
package com.company.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidDateRangeValidator.class)
public @interface ValidDateRange {
    String message() default "End date must be after start date";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

### Validator

```java
package com.company.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidDateRangeValidator implements ConstraintValidator<ValidDateRange, Object> {

    @Override
    public boolean isValid(Object value, ConstraintValidatorContext context) {
        if (value == null) return true;

        // Use reflection or pattern matching to get dates
        if (value instanceof PersonCreateRequest req) {
            if (req.endDate() == null) return true;
            return req.endDate().isAfter(req.startDate());
        }
        return true;
    }
}
```

## Database Migrations (Flyway)

Store migrations in `src/main/resources/db/migration/`:

```sql
-- V1__create_people_table.sql
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL,
    salary DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    department_id UUID REFERENCES departments(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_department ON people(department_id);
```

**Naming convention:** `V{version}__{description}.sql`

## Application Configuration

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/myapp
    username: ${DB_USER:postgres}
    password: ${DB_PASSWORD:postgres}
  
  jpa:
    hibernate:
      ddl-auto: validate  # Use Flyway for schema management
    open-in-view: false   # Disable OSIV anti-pattern
    properties:
      hibernate:
        format_sql: true
  
  flyway:
    enabled: true
    locations: classpath:db/migration
  
  # Virtual threads (Java 21+)
  threads:
    virtual:
      enabled: true

server:
  port: ${PORT:8080}

logging:
  level:
    com.company: DEBUG
    org.springframework.web: INFO
```

## Virtual Threads (Java 21+)

Virtual threads dramatically improve throughput for I/O-bound applications by allowing millions of concurrent threads with minimal overhead.

### Enable in Spring Boot 3.2+

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true  # All request handling uses virtual threads
```

### Benefits

- **High concurrency**: Handle thousands of concurrent requests without thread pool exhaustion
- **Simpler code**: Write blocking code that scales like async code
- **No code changes**: Existing synchronous code automatically benefits

### When to Use

```java
// ✅ Virtual threads shine for I/O-bound operations
@Service
public class ExternalApiService {
    
    public Data fetchFromMultipleSources(List<String> urls) {
        // Each call blocks, but virtual threads make this efficient
        return urls.stream()
            .map(this::fetchFromUrl)  // Blocking HTTP calls
            .toList();
    }
    
    // Virtual threads handle blocking I/O efficiently
    private Data fetchFromUrl(String url) {
        return restTemplate.getForObject(url, Data.class);  // Blocking is OK!
    }
}
```

### When NOT to Use

```java
// ❌ Avoid for CPU-bound operations
// Virtual threads don't help with pure computation
public BigInteger computeFactorial(int n) {
    // CPU-intensive - use platform threads or parallel streams instead
    return IntStream.rangeClosed(1, n)
        .parallel()  // Uses ForkJoinPool (platform threads)
        .mapToObj(BigInteger::valueOf)
        .reduce(BigInteger.ONE, BigInteger::multiply);
}
```

### Structured Concurrency (Preview in Java 21)

```java
// For parallel operations with proper error handling
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<User> userFuture = scope.fork(() -> userService.getUser(id));
    Future<List<Order>> ordersFuture = scope.fork(() -> orderService.getOrders(id));
    
    scope.join();           // Wait for all tasks
    scope.throwIfFailed();  // Propagate exceptions
    
    return new UserWithOrders(userFuture.resultNow(), ordersFuture.resultNow());
}
```

### Configuration for High Throughput

```yaml
# For very high concurrency scenarios
spring:
  threads:
    virtual:
      enabled: true

# Increase connection pool to match virtual thread capacity
  datasource:
    hikari:
      maximum-pool-size: 50  # Virtual threads can handle more connections
      minimum-idle: 10
```

## Testing with Testcontainers

```java
package com.company.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class PersonControllerTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createPerson_validRequest_returns201() throws Exception {
        String json = """
            {
                "name": "John Doe",
                "email": "john@example.com",
                "status": "ACTIVE",
                "salary": 5000.00,
                "startDate": "2024-01-01"
            }
            """;

        mockMvc.perform(post("/api/v1/people")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("John Doe"));
    }

    @Test
    void createPerson_invalidEmail_returns400() throws Exception {
        String json = """
            {
                "name": "John Doe",
                "email": "invalid-email",
                "status": "ACTIVE",
                "startDate": "2024-01-01"
            }
            """;

        mockMvc.perform(post("/api/v1/people")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isBadRequest());
    }
}
```

## Code Quality & Best Practices

### Use Optional Correctly

```java
// ✅ Good - use Optional for return types that may be absent
public Optional<User> findByEmail(String email) { }

// ✅ Good - chain Optional operations
return userRepository.findById(id)
    .map(this::toResponse)
    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

// ✅ Good - ifPresent for side effects
userRepository.findByEmail(email).ifPresent(existing -> {
    throw new ResponseStatusException(HttpStatus.CONFLICT, "Email exists");
});

// ❌ Avoid - Optional.get() without check
User user = userRepository.findById(id).get();  // Throws if empty

// ❌ Avoid - Optional for parameters or fields
public void process(Optional<String> name) { }  // Use @Nullable or overloading
```

### Prefer Records for DTOs

```java
// ✅ Good - immutable, concise, auto-generates equals/hashCode/toString
public record UserResponse(
    UUID id,
    String name,
    String email,
    LocalDateTime createdAt
) {}

// ❌ Avoid - verbose POJOs for simple DTOs
public class UserResponse {
    private UUID id;
    private String name;
    // ... getters, setters, equals, hashCode, toString
}
```

### Use Switch Expressions (Java 14+)

```java
// ✅ Good - switch expression with arrow syntax
String message = switch (status) {
    case ACTIVE -> "User is active";
    case INACTIVE -> "User is inactive";
    case PENDING -> "Awaiting verification";
    case SUSPENDED -> "Account suspended";
};

// ✅ Good - exhaustive switch (compiler checks all cases)
int priority = switch (severity) {
    case LOW -> 1;
    case MEDIUM -> 2;
    case HIGH -> 3;
    case CRITICAL -> 4;
};

// ❌ Avoid - old switch with fall-through risks
String message;
switch (status) {
    case ACTIVE:
        message = "User is active";
        break;
    case INACTIVE:
        message = "User is inactive";
        break;
    // Missing cases silently ignored
}
```

### Prefer Stream API for Collections

```java
// ✅ Good - declarative, readable
List<String> activeEmails = users.stream()
    .filter(User::isActive)
    .map(User::getEmail)
    .toList();

boolean hasAdmin = users.stream()
    .anyMatch(u -> u.getRole() == Role.ADMIN);

Map<Role, List<User>> byRole = users.stream()
    .collect(Collectors.groupingBy(User::getRole));

// ❌ Avoid - imperative loops for simple transformations
List<String> activeEmails = new ArrayList<>();
for (User user : users) {
    if (user.isActive()) {
        activeEmails.add(user.getEmail());
    }
}
```

### Avoid Null - Use Empty Collections

```java
// ✅ Good - return empty collection, never null
public List<User> findByDepartment(UUID deptId) {
    return repository.findByDepartmentId(deptId);  // Returns empty list if none
}

// ✅ Good - initialize collections
@ManyToMany
private Set<Skill> skills = new HashSet<>();

// ❌ Avoid - returning null
public List<User> findByDepartment(UUID deptId) {
    var users = repository.findByDepartmentId(deptId);
    return users.isEmpty() ? null : users;  // Caller must null-check
}
```

### Use @Slf4j with Structured Logging

```java
// ✅ Good - structured logging with placeholders
@Slf4j
@Service
public class UserService {
    public void createUser(CreateUserRequest request) {
        // ... create user
        log.info("user.created id={} email={}", user.getId(), user.getEmail());
    }
    
    public void deleteUser(UUID id) {
        log.warn("user.deleted id={} deletedBy={}", id, getCurrentUserId());
    }
}

// ❌ Avoid - string concatenation in logs
log.info("Created user: " + user.getId() + " with email: " + user.getEmail());
```

### Constructor Injection Over Field Injection

```java
// ✅ Good - constructor injection (immutable, testable)
@Service
public class UserService {
    private final UserRepository userRepository;
    private final EmailService emailService;
    
    public UserService(UserRepository userRepository, EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
    }
}

// ❌ Avoid - field injection (harder to test, mutable)
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private EmailService emailService;
}
```

### Use Meaningful Validation Messages

```java
// ✅ Good - clear validation messages
public record CreateUserRequest(
    @NotBlank(message = "Name is required")
    String name,
    
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email,
    
    @NotNull(message = "Start date is required")
    @FutureOrPresent(message = "Start date cannot be in the past")
    LocalDate startDate
) {}

// ❌ Avoid - default messages
public record CreateUserRequest(
    @NotBlank String name,  // Message: "must not be blank" (unclear)
    @Email String email
) {}
```

### Handle Exceptions Properly

```java
// ✅ Good - specific exception handling
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity
            .status(ex.getStatusCode())
            .body(new ErrorResponse(ex.getReason()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                FieldError::getDefaultMessage
            ));
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("Validation failed", errors));
    }
}

record ErrorResponse(String message, Map<String, String> fieldErrors) {
    ErrorResponse(String message) { this(message, null); }
}
```

### Use Constants for Magic Values

```java
// ✅ Good - named constants
public class Limits {
    public static final int MAX_PAGE_SIZE = 100;
    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_NAME_LENGTH = 255;
}

@GetMapping
public List<UserResponse> list(
    @RequestParam(defaultValue = "1") int page,
    @RequestParam(defaultValue = "20") @Max(100) int size
) { }

// ❌ Avoid - magic numbers
if (size > 100) {  // What's special about 100?
    size = 100;
}
```

### Text Blocks for Multi-line Strings (Java 15+)

```java
// ✅ Good - readable multi-line strings
String query = """
    SELECT u.id, u.name, u.email
    FROM users u
    JOIN departments d ON u.department_id = d.id
    WHERE d.name = :deptName
    ORDER BY u.name
    """;

String json = """
    {
        "name": "%s",
        "email": "%s"
    }
    """.formatted(name, email);

// ❌ Avoid - string concatenation
String query = "SELECT u.id, u.name, u.email " +
    "FROM users u " +
    "JOIN departments d ON u.department_id = d.id " +
    "WHERE d.name = :deptName";
```

## Best Practices Summary

1. **Layered architecture**: Controller → Service → Repository → Entity
2. **Constructor injection**: Not `@Autowired` on fields
3. **Transactions**: `@Transactional(readOnly = true)` for reads
4. **DTOs**: Separate request/response, use Java Records
5. **Validation**: Use Bean Validation + custom validators
6. **IDs**: Use `UUID` over `Long`
7. **Enums**: Store as `STRING` not `ORDINAL`
8. **Logging**: Structured with context (`id={}`)
9. **Errors**: `ResponseStatusException` for HTTP errors
10. **Testing**: Testcontainers for real database tests
11. **Migrations**: Flyway for schema versioning
12. **Virtual threads**: Enable for I/O-bound apps (Java 21+, Spring Boot 3.2+)
