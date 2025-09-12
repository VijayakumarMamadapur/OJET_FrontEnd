define([], function () {
  const base = {
    core: 'http://localhost:8080/api/v1',
    document: 'http://localhost:8082/api/v1',
    payment: 'http://localhost:8083/api/v1',
    notification: 'http://localhost:8084/api/v1'
  };
  return { base };
});

